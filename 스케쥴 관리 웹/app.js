/**
 * =====================================================================
 *  [주간 약속 조율 & 일정 매칭 로직: schedule.js]
 * =====================================================================
 *  - 7일간의 요일별 점심/저녁 일정 상태 관리
 *  - 친구별 일정 실시간 교차 검증 및 최적 만남 일시 자동 계산
 *  - 원클릭 세그먼트 토글 ([ ✓ 이용/가능 ] vs [ 안 함/바쁨 ])
 *  - 로컬 스토리지(LocalStorage) 저장 및 초대 링크 복사
 * =====================================================================
 */

// 1. 요일 메타데이터 정의
const DAYS_DATA = [
  { id: 'mon', name: '9. 7. (월)', badge: '일근', weekend: false, confirmAlert: false },
  { id: 'tue', name: '9. 8. (화)', badge: '일근', weekend: false, confirmAlert: false },
  { id: 'wed', name: '9. 9. (수)', badge: '일근', weekend: false, confirmAlert: false },
  { id: 'thu', name: '9. 10. (목)', badge: '일근', weekend: false, confirmAlert: true }, // 확인 배지
  { id: 'fri', name: '9. 11. (금)', badge: '일근', weekend: false, confirmAlert: false },
  { id: 'sat', name: '9. 12. (토)', badge: '주말', weekend: true, confirmAlert: false },
  { id: 'sun', name: '9. 13. (일)', badge: '주말', weekend: true, confirmAlert: false }
];

// 2. 참여 멤버 정의
const MEMBERS = {
  me: { name: '김건영', initial: '김', role: '나 (주최자)' },
  friend1: { name: '박민수', initial: '박', role: '친구' },
  friend2: { name: '이지은', initial: '이', role: '친구' },
  friend3: { name: '최현우', initial: '최', role: '친구' }
};

// 3. 기본 일정 템플릿
const DEFAULT_SCHEDULES = {
  me: {
    mon: { lunch: true, dinner: false },
    tue: { lunch: true, dinner: false },
    wed: { lunch: true, dinner: false },
    thu: { lunch: true, dinner: false },
    fri: { lunch: true, dinner: true },
    sat: { lunch: true, dinner: true },
    sun: { lunch: true, dinner: false }
  },
  friend1: {
    mon: { lunch: true, dinner: false },
    tue: { lunch: true, dinner: false },
    wed: { lunch: false, dinner: false },
    thu: { lunch: true, dinner: false },
    fri: { lunch: true, dinner: true },
    sat: { lunch: true, dinner: true },
    sun: { lunch: false, dinner: false }
  },
  friend2: {
    mon: { lunch: false, dinner: false },
    tue: { lunch: true, dinner: false },
    wed: { lunch: true, dinner: false },
    thu: { lunch: false, dinner: false },
    fri: { lunch: true, dinner: true },
    sat: { lunch: true, dinner: true },
    sun: { lunch: true, dinner: true }
  },
  friend3: {
    mon: { lunch: true, dinner: false },
    tue: { lunch: true, dinner: false },
    wed: { lunch: true, dinner: false },
    thu: { lunch: true, dinner: false },
    fri: { lunch: true, dinner: true },
    sat: { lunch: true, dinner: false },
    sun: { lunch: false, dinner: false }
  }
};

// 앱 상태 변수
let currentUserId = 'me';
let schedules = {};

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  loadSchedules();
  renderScheduleRows();
  updateMatchingResults();
  setupEventListeners();
});

/**
 * 로컬 스토리지에서 일정 불러오기
 */
function loadSchedules() {
  const saved = localStorage.getItem('wemeet_schedules_v1');
  if (saved) {
    try {
      schedules = JSON.parse(saved);
      return;
    } catch (e) {
      console.error('Failed to parse saved schedules', e);
    }
  }
  // 기본 데이터 깊은 복사
  schedules = JSON.parse(JSON.stringify(DEFAULT_SCHEDULES));
}

/**
 * 일정 로컬 스토리지에 저장
 */
function saveSchedules() {
  localStorage.setItem('wemeet_schedules_v1', JSON.stringify(schedules));
}

/**
 * 일주일 행 렌더링
 */
function renderScheduleRows() {
  const container = document.getElementById('schedule-rows-container');
  if (!container) return;

  container.innerHTML = '';
  const mySchedule = schedules[currentUserId] || schedules['me'];

  DAYS_DATA.forEach((day) => {
    const daySchedule = mySchedule[day.id] || { lunch: true, dinner: false };
    const lunchAvail = daySchedule.lunch === true;
    const dinnerAvail = daySchedule.dinner === true;

    // 친구들 참여 상태 계산
    const lunchStats = getSlotParticipation(day.id, 'lunch');
    const dinnerStats = getSlotParticipation(day.id, 'dinner');

    // 4명 모두 가능 여부 체크
    const isAllMatch = lunchStats.isAllAvailable || dinnerStats.isAllAvailable;

    const row = document.createElement('div');
    row.className = `schedule-row ${day.weekend ? 'weekend' : ''} ${isAllMatch ? 'all-match-day' : ''}`;
    row.setAttribute('data-day-id', day.id);

    row.innerHTML = `
      <!-- 날짜 및 일정 구분 -->
      <div class="date-col">
        <span class="date-text">${day.name}</span>
        <span class="status-badge ${day.weekend ? 'weekend-tag' : ''}">${day.badge}</span>
      </div>

      <!-- 시간대별 세그먼트 토글 버튼 -->
      <div class="slots-col">
        
        <!-- 점심 시간대 -->
        <div class="slot-block">
          <div class="slot-header">
            <span>점심</span>
          </div>
          <div class="segmented-control" data-day="${day.id}" data-slot="lunch">
            <button class="segment-btn ${lunchAvail ? 'active available' : ''}" data-action="available">
              <i class="fa-solid fa-check"></i> 이용
            </button>
            <button class="segment-btn ${!lunchAvail ? 'active busy' : ''}" data-action="busy">
              안 함
            </button>
          </div>
          <div class="slot-friends-status ${lunchStats.statusClass}">
            ${lunchStats.icon} ${lunchStats.text}
          </div>
        </div>

        <!-- 저녁 시간대 -->
        <div class="slot-block">
          <div class="slot-header">
            <span>저녁</span>
            ${day.confirmAlert ? '<span class="confirm-alert-badge">확인</span>' : ''}
          </div>
          <div class="segmented-control" data-day="${day.id}" data-slot="dinner">
            <button class="segment-btn ${dinnerAvail ? 'active available' : ''}" data-action="available">
              <i class="fa-solid fa-check"></i> 이용
            </button>
            <button class="segment-btn ${!dinnerAvail ? 'active busy' : ''}" data-action="busy">
              안 함
            </button>
          </div>
          <div class="slot-friends-status ${dinnerStats.statusClass}">
            ${dinnerStats.icon} ${dinnerStats.text}
          </div>
        </div>

      </div>
    `;

    container.appendChild(row);
  });

  // 세그먼트 버튼 클릭 이벤트 바인딩
  setupSegmentButtons();
}

/**
 * 특정 시간대 멤버 참여율 계산 함수
 */
function getSlotParticipation(dayId, slot) {
  const memberKeys = Object.keys(MEMBERS);
  const availableMembers = [];

  memberKeys.forEach(mKey => {
    if (schedules[mKey] && schedules[mKey][dayId] && schedules[mKey][dayId][slot]) {
      availableMembers.push(MEMBERS[mKey].name);
    }
  });

  const count = availableMembers.length;
  const total = memberKeys.length;

  if (count === total) {
    return {
      isAllAvailable: true,
      statusClass: 'all-ok',
      icon: '<i class="fa-solid fa-crown" style="color: #10b981;"></i>',
      text: `전원 가능 (${total}명 모두!)`
    };
  } else if (count >= 2) {
    return {
      isAllAvailable: false,
      statusClass: 'partial',
      icon: '<i class="fa-solid fa-circle-check"></i>',
      text: `${count}명 가능 (${availableMembers.slice(0, 2).join(', ')}${count > 2 ? ' 외' : ''})`
    };
  } else if (count === 1) {
    return {
      isAllAvailable: false,
      statusClass: 'none',
      icon: '<i class="fa-regular fa-circle"></i>',
      text: `${availableMembers[0]}만 가능`
    };
  } else {
    return {
      isAllAvailable: false,
      statusClass: 'none',
      icon: '<i class="fa-solid fa-ban"></i>',
      text: `모두 불참`
    };
  }
}

/**
 * 세그먼트 토글 버튼 동작 설정
 */
function setupSegmentButtons() {
  const controls = document.querySelectorAll('.segmented-control');
  controls.forEach(ctrl => {
    const dayId = ctrl.getAttribute('data-day');
    const slot = ctrl.getAttribute('data-slot');
    const btns = ctrl.querySelectorAll('.segment-btn');

    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        const isAvailable = (action === 'available');

        // 현재 사용자 데이터 업데이트
        if (!schedules[currentUserId]) schedules[currentUserId] = {};
        if (!schedules[currentUserId][dayId]) schedules[currentUserId][dayId] = {};
        schedules[currentUserId][dayId][slot] = isAvailable;

        saveSchedules();

        // UI 갱신
        renderScheduleRows();
        updateMatchingResults();

        const dayName = DAYS_DATA.find(d => d.id === dayId)?.name || '';
        const slotText = slot === 'lunch' ? '점심' : '저녁';
        const statusWord = isAvailable ? '이용(가능)' : '안 함(바쁨)';
        showToast(`📅 ${dayName} ${slotText}을 [${statusWord}]으로 설정했습니다.`);
      });
    });
  });
}

/**
 * 만남 추천 실시간 매칭 알고리즘
 */
function updateMatchingResults() {
  const allMatchSlots = [];
  const partialMatchSlots = [];

  DAYS_DATA.forEach(day => {
    ['lunch', 'dinner'].forEach(slot => {
      const stats = getSlotParticipation(day.id, slot);
      const slotName = slot === 'lunch' ? '점심' : '저녁';
      const label = `${day.name.split(' ')[1]} ${slotName}`; // 예: (금) 저녁

      if (stats.isAllAvailable) {
        allMatchSlots.push(label);
      } else if (stats.statusClass === 'partial') {
        partialMatchSlots.push(label);
      }
    });
  });

  const heroTextEl = document.getElementById('hero-recommend-text');
  const heroSubEl = document.getElementById('hero-recommend-sub');
  const badgeEl = document.getElementById('match-count-badge');

  if (allMatchSlots.length > 0) {
    if (heroTextEl) heroTextEl.textContent = allMatchSlots.join(' · ');
    if (heroSubEl) heroSubEl.textContent = `(친구 3명과 나 모두 시간 일치!)`;
    if (badgeEl) badgeEl.textContent = `${allMatchSlots.length}일 추천`;
  } else if (partialMatchSlots.length > 0) {
    if (heroTextEl) heroTextEl.textContent = `${partialMatchSlots.slice(0, 2).join(' · ')}`;
    if (heroSubEl) heroSubEl.textContent = `(대부분 참석 가능한 시간대)`;
    if (badgeEl) badgeEl.textContent = `${partialMatchSlots.length}일 가능`;
  } else {
    if (heroTextEl) heroTextEl.textContent = `시간을 조율 중입니다`;
    if (heroSubEl) heroSubEl.textContent = `친구들에게 가능한 날을 입력해 달라고 요청해 보세요!`;
    if (badgeEl) badgeEl.textContent = `0일`;
  }
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
  // 1. 사용자/친구 전환 셀렉터
  const userSwitcher = document.getElementById('user-switcher');
  if (userSwitcher) {
    userSwitcher.addEventListener('change', (e) => {
      currentUserId = e.target.value;
      const user = MEMBERS[currentUserId] || MEMBERS.me;

      // 좌측 하단 프로필 표시 업데이트
      const avatarEl = document.getElementById('current-user-avatar');
      const nameEl = document.getElementById('current-user-name');
      if (avatarEl) avatarEl.textContent = user.initial;
      if (nameEl) nameEl.textContent = user.name;

      renderScheduleRows();
      showToast(`👤 [${user.name}] 님의 일정 편집 모드로 전환했습니다.`);
    });
  }

  // 2. 기본 설정으로 초기화 버튼
  const resetBtn = document.getElementById('btn-reset-default');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      schedules[currentUserId] = JSON.parse(JSON.stringify(DEFAULT_SCHEDULES[currentUserId] || DEFAULT_SCHEDULES.me));
      saveSchedules();
      renderScheduleRows();
      updateMatchingResults();
      showToast('🔄 모든 요일의 일정이 기본값으로 재설정되었습니다.');
    });
  }

  // 3. 주말만 가능으로 일괄 설정
  const weekendOnlyBtn = document.getElementById('btn-weekend-only');
  if (weekendOnlyBtn) {
    weekendOnlyBtn.addEventListener('click', () => {
      DAYS_DATA.forEach(d => {
        if (!schedules[currentUserId][d.id]) schedules[currentUserId][d.id] = {};
        if (d.weekend) {
          schedules[currentUserId][d.id].lunch = true;
          schedules[currentUserId][d.id].dinner = true;
        } else {
          schedules[currentUserId][d.id].lunch = false;
          schedules[currentUserId][d.id].dinner = false;
        }
      });
      saveSchedules();
      renderScheduleRows();
      updateMatchingResults();
      showToast('🏖️ 주말만 가능(평일 바쁨)으로 일괄 변경되었습니다.');
    });
  }

  // 4. 모두 가능으로 일괄 설정
  const allAvailBtn = document.getElementById('btn-all-available');
  if (allAvailBtn) {
    allAvailBtn.addEventListener('click', () => {
      DAYS_DATA.forEach(d => {
        if (!schedules[currentUserId][d.id]) schedules[currentUserId][d.id] = {};
        schedules[currentUserId][d.id].lunch = true;
        schedules[currentUserId][d.id].dinner = true;
      });
      saveSchedules();
      renderScheduleRows();
      updateMatchingResults();
      showToast('✨ 일주일 전체를 [가능]으로 일괄 변경했습니다.');
    });
  }

  // 5. 친구 초대 링크 복사
  const copyBtns = [document.getElementById('btn-copy-invite'), document.getElementById('btn-share-profile')];
  copyBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        const shareUrl = window.location.href;
        navigator.clipboard.writeText(shareUrl).then(() => {
          showToast('🔗 일정 조율 초대 링크가 복사되었습니다! 카카오톡에 붙여넣어 보세요.');
        }).catch(() => {
          showToast('🔗 일정 조율 링크: ' + shareUrl);
        });
      });
    }
  });

  // 6. 친구별 전체 일정표 매트릭스 모달
  const matrixModal = document.getElementById('matrix-modal');
  const viewMatrixBtns = [document.getElementById('btn-view-matrix'), document.getElementById('nav-match-result')];
  const closeMatrixBtn = document.getElementById('btn-close-matrix');
  const okMatrixBtn = document.getElementById('btn-matrix-ok');

  const openMatrix = (e) => {
    if (e) e.preventDefault();
    renderMatrixTable();
    if (matrixModal) {
      matrixModal.classList.add('open');
      matrixModal.setAttribute('aria-hidden', 'false');
    }
  };

  const closeMatrix = () => {
    if (matrixModal) {
      matrixModal.classList.remove('open');
      matrixModal.setAttribute('aria-hidden', 'true');
    }
  };

  viewMatrixBtns.forEach(btn => {
    if (btn) btn.addEventListener('click', openMatrix);
  });

  if (closeMatrixBtn) closeMatrixBtn.addEventListener('click', closeMatrix);
  if (okMatrixBtn) okMatrixBtn.addEventListener('click', closeMatrix);

  if (matrixModal) {
    matrixModal.addEventListener('click', (e) => {
      if (e.target === matrixModal) closeMatrix();
    });
  }
}

/**
 * 전체 친구 일정 비교 매트릭스 테이블 렌더링
 */
function renderMatrixTable() {
  const table = document.getElementById('matrix-table');
  if (!table) return;

  const memberKeys = Object.keys(MEMBERS);

  let html = `
    <thead>
      <tr>
        <th>날짜</th>
        <th>시간대</th>
        ${memberKeys.map(k => `<th>${MEMBERS[k].name}</th>`).join('')}
        <th>매칭 상태</th>
      </tr>
    </thead>
    <tbody>
  `;

  DAYS_DATA.forEach(day => {
    ['lunch', 'dinner'].forEach((slot, sIdx) => {
      const slotLabel = slot === 'lunch' ? '점심' : '저녁';
      const stats = getSlotParticipation(day.id, slot);

      html += `<tr>`;
      if (sIdx === 0) {
        html += `<td rowspan="2" style="font-weight: 800; background: #fafafa;">${day.name}</td>`;
      }
      html += `<td>${slotLabel}</td>`;

      memberKeys.forEach(mKey => {
        const isAvail = schedules[mKey]?.[day.id]?.[slot];
        if (isAvail) {
          html += `<td class="cell-ok">가능</td>`;
        } else {
          html += `<td class="cell-busy">불가</td>`;
        }
      });

      if (stats.isAllAvailable) {
        html += `<td class="cell-golden">👑 4명 전원 확정!</td>`;
      } else {
        html += `<td>${stats.text}</td>`;
      }

      html += `</tr>`;
    });
  });

  html += `</tbody>`;
  table.innerHTML = html;
}

/**
 * 토스트 알림창 표시 유틸
 */
let toastTimeout;
function showToast(message) {
  const toast = document.getElementById('toast-message');
  if (!toast) return;

  toast.innerHTML = `<i class="fa-solid fa-bell"></i> ${message}`;
  toast.classList.add('show');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}
