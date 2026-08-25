"""
틀린 그림 찾기 — 고친 자리가 얼마나 눈에 띄는지 재는 도구.

`logic.ts`의 PHOTOS를 읽어, 화면에서 하는 것과 같은 변형(mirror/scale/clone)을
사진에 그대로 적용해 보고 "원본과 얼마나 다른가"를 숫자로 뽑는다.

왜 필요한가:
  균일한 털을 뒤집으면 아무것도 안 바뀌어서 아무도 못 찾는다. 반대로 멀리서
  끌어와 덮으면 뭉갠 자국이 남아 한눈에 보인다. 눈으로 하나씩 확인하려면
  브라우저를 계속 띄워야 하는데, 여기서는 사진만 놓고 즉시 잰다.

쓰는 법:
  python scripts/check-spotdiff.py            # 표만 본다
  python scripts/check-spotdiff.py --dump out # 고친 사진을 out/ 에 저장해 눈으로 본다

읽는 법:
  score 는 고친 자리 안에서 원본과 달라진 정도(0~255)다.
  너무 낮으면 아무도 못 찾고, 너무 높으면 티가 나서 게임이 안 된다.
"""

import argparse
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__))
CLIENT = os.path.dirname(HERE)
LOGIC = os.path.join(CLIENT, "src", "games", "spotDiff", "logic.ts")
PHOTOS_DIR = os.path.join(CLIENT, "assets", "photos")

# 고친 자리가 얼마나 달라 보이는가.
#
# 12~70(너무 어려움) → 70~130(티남) → 45~80(20초에 1~2개, 난이도 8~9) → 60~95(지금).
# 실제로 해본 사람이 몇 개 찾는지가 유일한 근거다.
# 위로 갈수록 쉽지만 "편집했구나"가 보이고, 아래로 갈수록 자연스럽지만 못 찾는다.
TOO_SUBTLE = 60.0
TOO_OBVIOUS = 95.0

# 이 아래로 흐린 자리는 뒤집으면 얼룩이 생겨 편집 티가 난다.
# 털결이 촘촘할수록 고친 자리가 진짜 질감에 묻힌다.
TOO_BLURRY = 20.0


def parse_photos(source: str):
    """logic.ts에서 PHOTOS 배열을 읽는다. 정식 파서가 아니라 형태에 기댄다."""
    start = source.index("export const PHOTOS")
    body = source[start : source.index("\n]", start)]

    photos = []
    for block in re.finditer(
        r"id: '(?P<id>\w+)',\s*subject: '(?P<subject>[^']+)'.*?patches: \[(?P<patches>.*?)\n    \],",
        body,
        re.S,
    ):
        # 패치는 한 줄에 하나씩 쓴다. rect 안쪽의 중괄호 때문에 통째로 정규식을 걸면 잘린다.
        patches = []
        for text in block.group("patches").splitlines():
            if "id:" not in text:
                continue
            rect = re.search(
                r"rect: \{ x: ([\d.]+), y: ([\d.]+), w: ([\d.]+), h: ([\d.]+) \}", text
            )
            patch = {
                "id": re.search(r"id: '(\w+)'", text).group(1),
                "kind": re.search(r"kind: '(\w+)'", text).group(1),
                "rect": [float(v) for v in rect.groups()],
            }
            for key in ("dx", "dy", "factor"):
                found = re.search(rf"\b{key}: (-?[\d.]+)", text)
                if found:
                    patch[key] = float(found.group(1))
            patches.append(patch)
        photos.append(
            {"id": block.group("id"), "subject": block.group("subject"), "patches": patches}
        )
    return photos


def soft_mask(size, rect):
    """화면에서 쓰는 것과 같은, 가장자리가 부드러운 타원 마스크."""
    w, h = size
    x, y, rw, rh = rect
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).ellipse(
        [x * w, y * h, (x + rw) * w, (y + rh) * h], fill=255
    )
    blur = max(3, int(min(rw * w, rh * h) * 0.18))
    return mask.filter(ImageFilter.GaussianBlur(blur))


def apply_patch(im, patch):
    """화면과 같은 변형을 적용한 사진을 돌려준다."""
    w, h = im.size
    x, y, rw, rh = patch["rect"]
    cx, cy = (x + rw / 2) * w, (y + rh / 2) * h

    if patch["kind"] == "mirror":
        moved = im.transpose(Image.FLIP_LEFT_RIGHT)
        moved = ImageChops.offset(moved, int(2 * cx - w), 0)
    elif patch["kind"] == "scale":
        f = patch["factor"]
        big = im.resize((int(w * f), int(h * f)), Image.LANCZOS)
        moved = Image.new("RGB", (w, h))
        moved.paste(big, (int(cx * (1 - f)), int(cy * (1 - f))))
    else:  # clone
        moved = ImageChops.offset(im, int(-patch["dx"] * w), int(-patch["dy"] * h))

    out = im.copy()
    out.paste(moved, (0, 0), soft_mask(im.size, patch["rect"]))
    return out


def score(im, changed, rect):
    """
    고친 자리에서 "확 달라진 지점"이 얼마나 뚜렷한지.

    영역 전체의 평균을 내면 안 된다. 뒤집기는 중심선 근처가 거의 안 바뀌므로
    영역을 넓힐수록 점수가 **떨어진다** — 실제로는 더 눈에 띄는데도.
    사람은 박스 전체가 아니라 확 달라진 한 지점을 보고 찾으므로,
    가장 많이 바뀐 상위 25% 픽셀의 평균을 쓴다.
    """
    w, h = im.size
    x, y, rw, rh = rect
    box = (int(x * w), int(y * h), int((x + rw) * w), int((y + rh) * h))
    diff = ImageChops.difference(im.crop(box), changed.crop(box)).convert("L")

    values = sorted(diff.getdata(), reverse=True)
    top = values[: max(1, len(values) // 4)]
    return sum(top) / len(top)


def detail(im, rect):
    """
    그 자리가 얼마나 선명한지 (윤곽이 얼마나 많은지).

    흐린 배경을 뒤집으면 얼룩이 생겨 "편집했구나"가 한눈에 보인다.
    반대로 털결·무늬처럼 선명한 곳은 뒤집어도 진짜 질감이라 위화감이 없다.
    픽셀 차이만 재면 이 둘을 구분할 수 없어서, 원본의 윤곽 양을 같이 본다.
    """
    w, h = im.size
    x, y, rw, rh = rect
    box = (int(x * w), int(y * h), int((x + rw) * w), int((y + rh) * h))
    edges = im.crop(box).convert("L").filter(ImageFilter.FIND_EDGES)
    return ImageStat.Stat(edges).mean[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dump", help="고친 사진을 저장할 폴더")
    args = ap.parse_args()

    photos = parse_photos(open(LOGIC, encoding="utf-8").read())
    if args.dump:
        os.makedirs(args.dump, exist_ok=True)

    problems = []
    print(f"{'사진':10s} {'고친 곳':14s} {'방식':7s} {'점수':>7s} {'선명도':>7s}   판정")
    print("-" * 70)
    for photo in photos:
        im = Image.open(os.path.join(PHOTOS_DIR, f"{photo['id']}.jpg")).convert("RGB")
        for patch in photo["patches"]:
            changed = apply_patch(im, patch)
            s = score(im, changed, patch["rect"])
            d = detail(im, patch["rect"])

            if d < TOO_BLURRY:
                verdict, bad = "흐린 배경, 얼룩져 보인다", True
            elif s < TOO_SUBTLE:
                verdict, bad = "너무 약함, 못 찾는다", True
            elif s > TOO_OBVIOUS:
                verdict, bad = "너무 셈, 티가 난다", True
            else:
                verdict, bad = "적당", False
            if bad:
                problems.append(f"{photo['id']}.{patch['id']} (점수 {s:.1f} 선명도 {d:.1f}) {verdict}")

            print(f"{photo['id']:10s} {patch['id']:14s} {patch['kind']:7s} {s:7.1f} {d:7.1f}   {verdict}")

            if args.dump:
                changed.save(os.path.join(args.dump, f"{photo['id']}-{patch['id']}.jpg"), quality=90)

    print()
    if problems:
        print(f"손봐야 할 곳 {len(problems)}개:")
        for p in problems:
            print("  -", p)
        return 1
    print("전부 적당하다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
