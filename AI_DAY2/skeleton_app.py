"""
====================================================================
 [AI_DAY2] 웹캠 인체 스켈레톤(Pose Estimation) 실시간 인식 프로그램
====================================================================
- 설명: 웹캠을 통해 사람의 관절 33개 포인트를 실시간으로 추적하고,
       뼈대(Skeleton)를 연결하여 화면에 직관적으로 시각화합니다.
- 키 조작 안내:
  * 'q' 또는 ESC : 프로그램 종료
  * 'm' : 뷰 모드 전환 (1. 웹캠 영상 + 스켈레톤 / 2. 네온 다크 모드)
  * 's' : 현재 화면 캡처 저장 (screenshots 폴더에 자동 저장)
  * 'f' : 화면 정보(FPS/상태) HUD 켜기/끄기
====================================================================
"""

import cv2
import mediapipe as mp
import numpy as np
import time
import os
from datetime import datetime

def main():
    # -------------------------------------------------------------
    # [1단계] MediaPipe 포즈 인식 모델 및 그리기 도구 초기화
    # -------------------------------------------------------------
    print("\n[안내] 인공지능 모델(MediaPipe Pose)을 불러오는 중입니다...")
    
    # MediaPipe의 Pose 솔루션 및 시각화 유틸리티 로드
    mp_pose = mp.solutions.pose
    mp_drawing = mp.solutions.drawing_utils
    mp_drawing_styles = mp.solutions.drawing_styles

    # Pose 모델 설정
    # - min_detection_confidence: 사람이 맞는지 감지하는 최소 신뢰도 (0.5 = 50%)
    # - min_tracking_confidence: 이전 프레임의 위치를 추적하는 최소 신뢰도 (0.5 = 50%)
    # - model_complexity: 모델 복잡도 (0: 속도 빠름, 1: 균형적, 2: 정확도 높음)
    pose = mp_pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        smooth_landmarks=True,
        enable_segmentation=False,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )

    # -------------------------------------------------------------
    # [2단계] 웹캠 카메라 연결
    # -------------------------------------------------------------
    print("[안내] 웹캠 카메라를 연결하는 중입니다...")
    
    # 기본 웹캠(인덱스 0) 열기 시도
    cap = cv2.VideoCapture(0)
    
    # 0번 카메라가 안 열릴 경우 1번 카메라 시도
    if not cap.isOpened():
        print("[경고] 0번 카메라 연결 실패. 1번 외장 카메라를 검색합니다...")
        cap = cv2.VideoCapture(1)

    if not cap.isOpened():
        print("\n[오류] 웹캠을 찾을 수 없습니다!")
        print("  1. 웹캠이 PC에 잘 연결되어 있는지 확인해 주세요.")
        print("  2. 다른 앱(Zoom, Teams, 브라우저 등)에서 카메라를 사용 중인지 확인해 주세요.")
        return

    # 카메라 해상도 권장치 설정 (1280x720 또는 640x480)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    # -------------------------------------------------------------
    # [3단계] 캡처 저장용 폴더 생성 및 UI 설정
    # -------------------------------------------------------------
    screenshot_dir = os.path.join(os.path.dirname(__file__), "screenshots")
    os.makedirs(screenshot_dir, exist_ok=True)

    # 프로그램 상태 변수들
    view_mode = 1         # 1: 일반 오버레이, 2: 네온 다크 모드
    show_hud = True       # FPS 및 안내 텍스트 표시 여부
    prev_time = time.time()
    fps = 0.0

    print("\n" + "=" * 55)
    print(" [프로그램 실행 성공] 웹캠 창이 활성화되었습니다.")
    print("  * 'q' 또는 ESC : 프로그램 종료")
    print("  * 'm'          : 뷰 모드 전환 (일반 오버레이 <-> 네온 다크)")
    print("  * 's'          : 현재 화면 스크린샷 캡처")
    print("  * 'f'          : 상단 정보창(HUD) 표시 토글")
    print("=" * 55 + "\n")

    # -------------------------------------------------------------
    # [4단계] 실시간 영상 루프 (캡처 -> AI 분석 -> 뼈대 렌더링)
    # -------------------------------------------------------------
    try:
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                print("[알림] 웹캠으로부터 프레임을 읽어올 수 없습니다.")
                break

            # 4-1. 거울 모드 (좌우 반전) 적용 - 셀카처럼 자연스럽게 보이도록 설정
            frame = cv2.flip(frame, 1)
            h, w, c = frame.shape

            # 4-2. BGR 이미지를 RGB로 변환 (MediaPipe는 RGB 포맷을 사용)
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # 성능 향상을 위해 쓰기 불가 플래그 설정 후 인공지능 추론
            rgb_frame.flags.writeable = False
            results = pose.process(rgb_frame)
            rgb_frame.flags.writeable = True

            # 4-3. 모드별 캔버스 준비
            if view_mode == 1:
                # [모드 1] 실제 웹캠 화면 위에 스켈레톤 덧그리기
                canvas = frame.copy()
            else:
                # [모드 2] 검은 배경에 스켈레톤만 네온 스타일로 그리기
                canvas = np.zeros((h, w, 3), dtype=np.uint8)

            # 4-4. 사람이 감지된 경우 스켈레톤(관절 점과 선) 그리기
            is_detected = results.pose_landmarks is not None

            if is_detected:
                if view_mode == 1:
                    # 기본 오버레이 모드: MediaPipe 기본 스타일 활용
                    mp_drawing.draw_landmarks(
                        canvas,
                        results.pose_landmarks,
                        mp_pose.POSE_CONNECTIONS,
                        landmark_drawing_spec=mp_drawing_styles.get_default_pose_landmarks_style()
                    )
                else:
                    # 네온 다크 모드: 사이버틱한 네온 시안/라임 색상으로 커스텀 그리기
                    # 선(뼈대) 그리기: 네온 시안 (RGB: 0, 240, 255)
                    connection_spec = mp_drawing.DrawingSpec(color=(255, 240, 0), thickness=3, circle_radius=2)
                    # 점(관절) 그리기: 네온 핑크/라임 (RGB: 255, 0, 180)
                    landmark_spec = mp_drawing.DrawingSpec(color=(0, 255, 128), thickness=4, circle_radius=4)
                    
                    mp_drawing.draw_landmarks(
                        canvas,
                        results.pose_landmarks,
                        mp_pose.POSE_CONNECTIONS,
                        landmark_drawing_spec=landmark_spec,
                        connection_drawing_spec=connection_spec
                    )

            # 4-5. FPS(초당 프레임 수) 계산
            curr_time = time.time()
            time_diff = curr_time - prev_time
            if time_diff > 0:
                fps = 0.9 * fps + 0.1 * (1.0 / time_diff)  # 부드러운 이동 평균
            prev_time = curr_time

            # 4-6. 상단 안내 HUD(헤드업 디스플레이) 그리기
            if show_hud:
                # 반투명 상단 헤더 박스 생성
                overlay = canvas.copy()
                cv2.rectangle(overlay, (0, 0), (w, 60), (20, 20, 20), -1)
                cv2.addWeighted(overlay, 0.65, canvas, 0.35, 0, canvas)

                # 상태 및 FPS 텍스트 표시
                status_text = "Tracking (Human Detected)" if is_detected else "Searching for person..."
                status_color = (0, 255, 100) if is_detected else (0, 165, 255)
                
                mode_name = "1: Webcam Overlay" if view_mode == 1 else "2: Cyber Dark Mode"

                cv2.putText(canvas, f"FPS: {int(fps)}", (20, 25), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
                cv2.putText(canvas, f"Mode: {mode_name}", (140, 25), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 215, 0), 2)
                cv2.putText(canvas, f"Status: {status_text}", (450, 25), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, status_color, 2)
                
                # 하단 안내 문구
                cv2.putText(canvas, "[Key Guide] 'm': Mode Toggle | 's': Save Photo | 'f': HUD | 'q': Exit", 
                            (20, 48), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (200, 200, 200), 1)

            # 4-7. 윈도우 창에 결과 이미지 표시
            cv2.imshow("AI Pose Skeleton Tracker (AI_DAY2)", canvas)

            # ---------------------------------------------------------
            # [5단계] 키보드 입력 처리
            # ---------------------------------------------------------
            key = cv2.waitKey(1) & 0xFF

            # 'q' 또는 ESC: 프로그램 종료
            if key == ord('q') or key == ord('Q') or key == 27:
                print("\n[안내] 프로그램을 종료합니다.")
                break

            # 'm': 뷰 모드 전환
            elif key == ord('m') or key == ord('M'):
                view_mode = 2 if view_mode == 1 else 1
                print(f"[모드 변경] 현재 모드: {'웹캠 오버레이' if view_mode == 1 else '네온 다크'}")

            # 'f': HUD 토글
            elif key == ord('f') or key == ord('F'):
                show_hud = not show_hud

            # 's': 스크린샷 캡처 및 파일 저장
            elif key == ord('s') or key == ord('S'):
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = os.path.join(screenshot_dir, f"skeleton_{timestamp}.png")
                cv2.imwrite(filename, canvas)
                print(f"[사진 저장 완료] {filename}")

    finally:
        # ---------------------------------------------------------
        # [6단계] 자원 정리 및 종료
        # ---------------------------------------------------------
        cap.release()
        cv2.destroyAllWindows()
        pose.close()
        print("[안내] 웹캠 장치와 창이 안전하게 종료되었습니다.\n")

if __name__ == "__main__":
    main()
