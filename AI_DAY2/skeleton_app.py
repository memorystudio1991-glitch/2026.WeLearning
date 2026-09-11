"""
====================================================================
 [AI_DAY2] 웹캠 인체 스켈레톤 & 실시간 비전 데이터 분석 프로그램
====================================================================
- 설명: PC 웹캠을 통해 실시간으로 사람의 33개 관절 랜드마크를 추적하고,
       상의 옷 색깔(Color), 신체비율 기반 성별/체형 추정, 자세 데이터를
       머리 위 'AI 비전 프로필 카드'로 실시간 시각화합니다.
- 키 조작 안내:
  * 'q' 또는 ESC : 프로그램 종료
  * 'm' : 뷰 모드 전환 (1. 웹캠 영상 + 스켈레톤 / 2. 네온 다크 모드)
  * 's' : 현재 화면 스크린샷 캡처 (screenshots 폴더에 자동 저장)
  * 'f' : 화면 정보(HUD/프로필 카드) 켜기/끄기
====================================================================
"""

import cv2
import mediapipe as mp
import numpy as np
import time
import os
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont

# 한글 폰트 로드 (윈도우 기본 맑은 고딕)
FONT_PATH = "C:/Windows/Fonts/malgun.ttf"
if os.path.exists(FONT_PATH):
    FONT_CARD_TITLE = ImageFont.truetype(FONT_PATH, 13)
    FONT_CARD_BODY = ImageFont.truetype(FONT_PATH, 14)
    FONT_CARD_SUB = ImageFont.truetype(FONT_PATH, 12)
    FONT_HUD = ImageFont.truetype(FONT_PATH, 15)
else:
    FONT_CARD_TITLE = FONT_CARD_BODY = FONT_CARD_SUB = FONT_HUD = None

def classify_color(r, g, b):
    """RGB 값을 한국어 색상명 및 BGR 튜플로 분류합니다."""
    brightness = (r + g + b) / 3
    max_c = max(r, g, b)
    min_c = min(r, g, b)
    delta = max_c - min_c
    sat = 0 if max_c == 0 else delta / max_c

    # 1. 무채색 (블랙, 화이트, 그레이)
    if brightness < 48:
        return "블랙", (35, 35, 35)
    if brightness > 195 and sat < 0.16:
        return "화이트", (245, 245, 245)
    if sat < 0.16:
        return "그레이", (128, 128, 128)

    # 2. 색상환(Hue) 계산 (0~360도)
    if delta == 0:
        h = 0
    elif max_c == r:
        h = ((g - b) / delta) % 6
    elif max_c == g:
        h = (b - r) / delta + 2
    else:
        h = (r - g) / delta + 4
    h = int(h * 60)
    if h < 0:
        h += 360

    # 3. 색상 판별 (BGR 색상 매핑)
    if h >= 345 or h < 14:
        return "레드", (50, 50, 230)
    elif h >= 14 and h < 42:
        if brightness < 100:
            return "브라운", (30, 70, 140)
        return "오렌지", (30, 130, 245)
    elif h >= 42 and h < 68:
        if sat < 0.35:
            return "베이지", (150, 185, 215)
        return "옐로우", (20, 215, 245)
    elif h >= 68 and h < 165:
        return "그린", (50, 195, 50)
    elif h >= 165 and h < 205:
        return "하늘/민트", (215, 200, 30)
    elif h >= 205 and h < 260:
        if brightness < 85:
            return "네이비", (138, 58, 30)
        return "블루", (235, 120, 50)
    elif h >= 260 and h < 315:
        return "퍼플", (210, 80, 170)
    else:
        return "핑크", (170, 70, 235)

def analyze_clothing_color(frame, landmarks, w, h):
    """어깨와 골반 사이의 몸통(Torso) 영역에서 옷 색상을 추출합니다."""
    lm = landmarks.landmark
    left_sh = lm[11]
    right_sh = lm[12]
    left_hip = lm[23]
    right_hip = lm[24]

    sh_cx = (left_sh.x + right_sh.x) / 2
    sh_cy = (left_sh.y + right_sh.y) / 2
    sh_w = np.hypot(left_sh.x - right_sh.x, left_sh.y - right_sh.y)

    if left_hip.visibility > 0.3 and right_hip.visibility > 0.3:
        hip_cy = (left_hip.y + right_hip.y) / 2
        torso_cy = sh_cy * 0.4 + hip_cy * 0.6
    else:
        torso_cy = sh_cy + sh_w * 0.45

    cx_px = int(sh_cx * w)
    cy_px = int(torso_cy * h)
    radius = max(10, int(sh_w * w * 0.08))

    x1 = max(0, cx_px - radius)
    x2 = min(w, cx_px + radius)
    y1 = max(0, cy_px - radius)
    y2 = min(h, cy_px + radius)

    if x2 <= x1 or y2 <= y1:
        return "분석 중", (128, 128, 128)

    roi = frame[y1:y2, x1:x2]
    mean_bgr = cv2.mean(roi)[:3]
    b, g, r = int(mean_bgr[0]), int(mean_bgr[1]), int(mean_bgr[2])

    color_name, sample_bgr = classify_color(r, g, b)
    return color_name, sample_bgr

def analyze_gender_body(landmarks):
    """어깨 대비 골반/체형 비율을 분석하여 성별 및 체형을 추정합니다."""
    lm = landmarks.landmark
    left_sh = lm[11]
    right_sh = lm[12]
    left_hip = lm[23]
    right_hip = lm[24]
    nose = lm[0]

    sh_w = np.hypot(left_sh.x - right_sh.x, left_sh.y - right_sh.y)

    if left_hip.visibility > 0.4 and right_hip.visibility > 0.4:
        hip_w = np.hypot(left_hip.x - right_hip.x, left_hip.y - right_hip.y)
        ratio = sh_w / max(0.01, hip_w)
        if ratio >= 1.26:
            return "남성 추정 (역삼각형 체형)"
        elif ratio <= 1.15:
            return "여성 추정 (골반 균형 체형)"
        else:
            return "슬림 / 표준 체형"

    head_h = abs(left_sh.y - nose.y)
    if head_h > 0.01 and (sh_w / head_h) > 1.85:
        return "남성 추정 (넓은 어깨형)"
    return "여성 추정 (슬림 어깨형)"

def analyze_posture(landmarks):
    """화각 및 자세 상태를 판별합니다."""
    lm = landmarks.landmark
    if lm[27].visibility > 0.4 or lm[28].visibility > 0.4:
        return "전신 (Full Body)"
    elif lm[25].visibility > 0.4 or lm[26].visibility > 0.4:
        return "미디엄 샷 (하체 일부)"
    return "상반신 (Close-up)"

def draw_profile_card_pillow(canvas, card_x, card_y, color_name, sample_bgr, gender_text, posture_text):
    """Pillow를 이용해 머리 위에 선명한 한글 AI 비전 프로필 카드를 그립니다."""
    card_w = 230
    card_h = 76
    radius = 12

    # 1. OpenCV 반투명 배경 박스
    overlay = canvas.copy()
    cv2.rectangle(overlay, (card_x, card_y), (card_x + card_w, card_y + card_h), (15, 18, 25), -1)
    cv2.addWeighted(overlay, 0.85, canvas, 0.15, 0, canvas)
    # 네온 테두리
    cv2.rectangle(canvas, (card_x, card_y), (card_x + card_w, card_y + card_h), (254, 242, 0), 2)

    # 2. 컬러칩 서클 그리기 (OpenCV)
    cv2.circle(canvas, (card_x + 128, card_y + 49), 7, sample_bgr, -1)
    cv2.circle(canvas, (card_x + 128, card_y + 49), 7, (255, 255, 255), 1)

    # 3. Pillow 한글 텍스트 렌더링
    if FONT_CARD_TITLE is not None:
        img_pil = Image.fromarray(cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(img_pil)

        draw.text((card_x + 10, card_y + 6), "⚡ AI VISION PROFILE", font=FONT_CARD_TITLE, fill=(0, 242, 254))
        draw.text((card_x + 10, card_y + 24), f"👤 성별: {gender_text}", font=FONT_CARD_BODY, fill=(245, 245, 245))
        draw.text((card_x + 10, card_y + 42), f"👕 상의: {color_name}", font=FONT_CARD_BODY, fill=(245, 245, 245))
        draw.text((card_x + 10, card_y + 59), f"📏 자세: {posture_text}", font=FONT_CARD_SUB, fill=(160, 175, 190))

        canvas[:] = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)

def main():
    print("\n[안내] 인공지능 모델(MediaPipe Pose)을 불러오는 중입니다...")
    
    mp_pose = mp.solutions.pose
    mp_drawing = mp.solutions.drawing_utils
    mp_drawing_styles = mp.solutions.drawing_styles

    pose = mp_pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        smooth_landmarks=True,
        enable_segmentation=False,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )

    print("[안내] PC 웹캠 카메라를 연결하는 중입니다...")
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        cap = cv2.VideoCapture(1)

    if not cap.isOpened():
        print("\n[오류] 웹캠을 찾을 수 없습니다!")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    screenshot_dir = os.path.join(os.path.dirname(__file__), "screenshots")
    os.makedirs(screenshot_dir, exist_ok=True)

    view_mode = 1
    show_hud = True
    prev_time = time.time()
    fps = 0.0

    print("\n" + "=" * 60)
    print(" [AI_DAY2] PC 웹캠 스켈레톤 & 비전 분석 프로그램 실행 성공")
    print("  * 'q' 또는 ESC : 프로그램 종료")
    print("  * 'm'          : 뷰 모드 전환 (웹캠 오버레이 <-> 네온 다크)")
    print("  * 's'          : 현재 화면 스크린샷 캡처")
    print("  * 'f'          : 상단 HUD 및 프로필 카드 표시 토글")
    print("=" * 60 + "\n")

    try:
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                break

            # 거울 모드 (좌우 반전)
            frame = cv2.flip(frame, 1)
            h, w, c = frame.shape

            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb_frame.flags.writeable = False
            results = pose.process(rgb_frame)
            rgb_frame.flags.writeable = True

            if view_mode == 1:
                canvas = frame.copy()
            else:
                canvas = np.zeros((h, w, 3), dtype=np.uint8)

            is_detected = results.pose_landmarks is not None
            color_name = "분석 중"
            sample_bgr = (128, 128, 128)
            gender_text = "분석 중"
            posture_text = "상반신"

            if is_detected:
                # 1. 스켈레톤 그리기
                if view_mode == 1:
                    mp_drawing.draw_landmarks(
                        canvas,
                        results.pose_landmarks,
                        mp_pose.POSE_CONNECTIONS,
                        landmark_drawing_spec=mp_drawing_styles.get_default_pose_landmarks_style()
                    )
                else:
                    connection_spec = mp_drawing.DrawingSpec(color=(255, 240, 0), thickness=3, circle_radius=2)
                    landmark_spec = mp_drawing.DrawingSpec(color=(0, 255, 128), thickness=4, circle_radius=4)
                    mp_drawing.draw_landmarks(
                        canvas,
                        results.pose_landmarks,
                        mp_pose.POSE_CONNECTIONS,
                        landmark_drawing_spec=landmark_spec,
                        connection_drawing_spec=connection_spec
                    )

                # 2. 옷 색상 및 성별/자세 분석
                color_name, sample_bgr = analyze_clothing_color(frame, results.pose_landmarks, w, h)
                gender_text = analyze_gender_body(results.pose_landmarks)
                posture_text = analyze_posture(results.pose_landmarks)

                # 3. 머리 위 AI 비전 프로필 카드 렌더링
                if show_hud:
                    nose = results.pose_landmarks.landmark[0]
                    left_sh = results.pose_landmarks.landmark[11]
                    right_sh = results.pose_landmarks.landmark[12]
                    sh_w = np.hypot(left_sh.x - right_sh.x, left_sh.y - right_sh.y)

                    card_x = int(nose.x * w - 115)
                    card_y = int((nose.y - sh_w * 0.75) * h)
                    card_x = max(10, min(w - 240, card_x))
                    card_y = max(65, min(h - 90, card_y))

                    draw_profile_card_pillow(canvas, card_x, card_y, color_name, sample_bgr, gender_text, posture_text)

            # FPS 계산
            curr_time = time.time()
            time_diff = curr_time - prev_time
            if time_diff > 0:
                fps = 0.9 * fps + 0.1 * (1.0 / time_diff)
            prev_time = curr_time

            # 상단 헤더 HUD 그리기
            if show_hud:
                overlay = canvas.copy()
                cv2.rectangle(overlay, (0, 0), (w, 55), (15, 18, 25), -1)
                cv2.addWeighted(overlay, 0.75, canvas, 0.25, 0, canvas)
                cv2.line(canvas, (0, 55), (w, 55), (0, 242, 254), 1)

                status_color = (0, 255, 100) if is_detected else (0, 165, 255)
                status_str = "Tracking" if is_detected else "Searching"

                if FONT_HUD is not None:
                    img_pil = Image.fromarray(cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB))
                    draw = ImageDraw.Draw(img_pil)

                    draw.text((15, 8), f"⚡ PoseLens AI", font=FONT_HUD, fill=(0, 242, 254))
                    draw.text((160, 8), f"FPS: {int(fps)}", font=FONT_HUD, fill=(255, 255, 255))
                    draw.text((250, 8), f"상의: {color_name}", font=FONT_HUD, fill=(255, 215, 0))
                    draw.text((370, 8), f"{gender_text.split(' ')[0]}", font=FONT_HUD, fill=(100, 220, 255))
                    draw.text((490, 8), f"상태: {status_str}", font=FONT_HUD, fill=status_color[::-1])
                    draw.text((15, 32), "[Key] 'm': 모드 변경 | 's': 사진 저장 | 'f': HUD 켜기/끄기 | 'q': 종료", font=FONT_CARD_SUB, fill=(170, 170, 170))

                    canvas[:] = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)

            cv2.imshow("AI PoseLens Tracker (PC WebCam)", canvas)

            key = cv2.waitKey(1) & 0xFF
            if key == ord('q') or key == ord('Q') or key == 27:
                break
            elif key == ord('m') or key == ord('M'):
                view_mode = 2 if view_mode == 1 else 1
            elif key == ord('f') or key == ord('F'):
                show_hud = not show_hud
            elif key == ord('s') or key == ord('S'):
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = os.path.join(screenshot_dir, f"poselens_pc_{timestamp}.png")
                cv2.imwrite(filename, canvas)
                print(f"[사진 저장 완료] {filename}")

    finally:
        cap.release()
        cv2.destroyAllWindows()
        pose.close()
        print("[안내] 프로그램이 안전하게 종료되었습니다.\n")

if __name__ == "__main__":
    main()
