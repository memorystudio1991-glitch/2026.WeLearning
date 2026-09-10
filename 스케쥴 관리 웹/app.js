/**
 * =====================================================================
 *  [주간 약속 & 조깅 조율 앱 로직: app.js]
 * =====================================================================
 *  - 참여자 기본 2명(나, 박민수) + 언제든 친구 추가/삭제 가능한 동적 구조
 *  - 3개 활동 슬롯: 점심(Lunch), 저녁(Dinner), 조깅(Jogging)
 *  - 일자별 비고란(메모) 텍스트 입력 및 실시간 로컬 스토리지 저장
 *  - 참여자 전원 가능 최적일 자동 계산 & 비교 매트릭스 모달
 * =====================================================================
 */

// 1. 실제 컴퓨터 시계(new Date()) 연동 동적 주간 메타데이터 생성 엔진
function generateWeeksConfig(baseDate = new Date()) {
  const dayOfWeek = baseDate.getDay(); // 0: 일, 1: 월, ..., 6: 토
  // 월요일을 주의 시작일로 계산
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  // 이번 주 월요일 00:00:00
  const currentMon = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + diffToMon);
  // 다음 주 월요일 00:00:00
  const nextMon = new Date(currentMon.getFullYear(), currentMon.getMonth(), currentMon.getDate() + 7);

  const dayNames = ['월', '화', '수', '목', '금', '토', '일'];
  const dayIds = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  const buildDays = (monDate) => {
    return dayIds.map((id, index) => {
      const d = new Date(monDate.getFullYear(), monDate.getMonth(), monDate.getDate() + index);
      const m = d.getMonth() + 1;
      const dateNum = d.getDate();
      const isWeekend = (index >= 5);
      const isToday = (
        d.getFullYear() === baseDate.getFullYear() &&
        d.getMonth() === baseDate.getMonth() &&
        d.getDate() === baseDate.getDate()
      );

      return {
        id,
        dateObj: d,
        dateStr: `${d.getFullYear()}-${String(m).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`,
        name: `${m}. ${dateNum}. (${dayNames[index]})`,
        badge: isToday ? '오늘' : (isWeekend ? '주말' : '일근'),
        isToday,
        weekend: isWeekend,
        confirmAlert: false
      };
    });
  };

  const currentDays = buildDays(currentMon);
  const nextDays = buildDays(nextMon);

  const currentSun = currentDays[6].dateObj;
  const nextSun = nextDays[6].dateObj;

  const currentRangeStr = `${currentMon.getMonth() + 1}.${currentMon.getDate()}~${currentSun.getMonth() + 1}.${currentSun.getDate()}`;
  const nextRangeStr = `${nextMon.getMonth() + 1}.${nextMon.getDate()}~${nextSun.getMonth() + 1}.${nextSun.getDate()}`;

  return {
    current: {
      key: 'current',
      title: '이번 주 약속 & 조깅 조율',
      subTag: 'WEEKLY PLANNER (THIS WEEK)',
      desc: `이번 주(${currentRangeStr}) 점심, 저녁, 조깅 일정을 선택하고 비고란에 메모를 남겨보세요. 둘 다 가능한 최적의 날짜를 실시간으로 찾아드려요.`,
      dateRange: currentRangeStr,
      days: currentDays
    },
    next: {
      key: 'next',
      title: '다음 주 약속 & 조깅 조율',
      subTag: 'WEEKLY PLANNER (NEXT WEEK)',
      desc: `다음 주(${nextRangeStr}) 일정을 미리 계획하고 약속을 사전에 조율해 보세요. 미리 일치하는 시간을 찾을 수 있어요.`,
      dateRange: nextRangeStr,
      days: nextDays
    }
  };
}

let WEEKS_CONFIG = generateWeeksConfig();

// 상단 주차 선택 캡슐 버튼 레이블을 실제 계산된 날짜로 업데이트하는 유틸
function updateWeekPillButtons() {
  const btnCurrent = document.getElementById('btn-week-current');
  const btnNext = document.getElementById('btn-week-next');
  if (btnCurrent && WEEKS_CONFIG.current) {
    btnCurrent.textContent = `이번 주 (${WEEKS_CONFIG.current.dateRange})`;
  }
  if (btnNext && WEEKS_CONFIG.next) {
    btnNext.textContent = `다음 주 (${WEEKS_CONFIG.next.dateRange})`;
  }
}

// 현재 활성화된 요일 목록 반환 헬퍼
function getActiveDays() {
  return WEEKS_CONFIG[currentWeek]?.days || WEEKS_CONFIG.current.days;
}

// 2. 활동 슬롯 정의 (점심, 저녁, 조깅)
const SLOTS_DATA = [
  { id: 'lunch', name: '점심', icon: '🥪', isJogging: false },
  { id: 'dinner', name: '저녁', icon: '🌙', isJogging: false },
  { id: 'jogging', name: '조깅', icon: '🏃', isJogging: true }
];

// 3. 기본 참여자 (초기 2명)
const DEFAULT_MEMBERS = {
  me: { id: 'me', name: '김건영', initial: '김', role: '나 (주최자)', isDefault: true },
  friend1: { id: 'friend1', name: '박민수', initial: '박', role: '친구', isDefault: true }
};

// 4. 기본 일정 템플릿
const DEFAULT_SCHEDULE_TEMPLATE = {
  mon: { lunch: false, dinner: false, jogging: false, memo: '' },
  tue: { lunch: false, dinner: false, jogging: false, memo: '' },
  wed: { lunch: false, dinner: false, jogging: false, memo: '' },
  thu: { lunch: false, dinner: false, jogging: false, memo: '' },
  fri: { lunch: false, dinner: false, jogging: false, memo: '' },
  sat: { lunch: false, dinner: false, jogging: false, memo: '' },
  sun: { lunch: false, dinner: false, jogging: false, memo: '' }
};

// 앱 상태 변수
let currentUserId = 'me';
let compareFriendId = 'friend1'; // 반으로 나뉜 화면 우측에 표시할 비교 대상 친구 ID
let currentView = 'schedule'; // 'schedule' 또는 'home'
let currentWeek = 'current'; // 'current'(이번 주) 또는 'next'(다음 주)
let members = {};
let schedules = { current: {}, next: {} };

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  initPasswordGate();
  loadData();
  updateWeekPillButtons();
  renderMemberSelectors();
  renderScheduleRows();
  updateMatchingResults();
  renderHomeDashboard();
  setupEventListeners();
});

/**
 * 로컬 스토리지에서 데이터 로드
 */
function loadData() {
  const savedMembers = localStorage.getItem('wemeet_members_v2');
  const savedSchedules = localStorage.getItem('wemeet_schedules_v3');
  const legacySchedules = localStorage.getItem('wemeet_schedules_v2');

  if (savedMembers) {
    try {
      members = JSON.parse(savedMembers);
    } catch (e) {
      members = JSON.parse(JSON.stringify(DEFAULT_MEMBERS));
    }
  } else {
    members = JSON.parse(JSON.stringify(DEFAULT_MEMBERS));
  }

  if (savedSchedules) {
    try {
      schedules = JSON.parse(savedSchedules);
    } catch (e) {
      schedules = { current: {}, next: {} };
    }
  } else if (legacySchedules) {
    try {
      const parsedLegacy = JSON.parse(legacySchedules);
      schedules = {
        current: parsedLegacy,
        next: {}
      };
    } catch (e) {
      schedules = { current: {}, next: {} };
    }
  } else {
    schedules = { current: {}, next: {} };
    Object.keys(members).forEach(k => {
      schedules.current[k] = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_TEMPLATE));
      schedules.next[k] = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_TEMPLATE));
    });
  }

  if (!schedules.current) schedules.current = {};
  if (!schedules.next) schedules.next = {};

  // 모든 멤버에 대해 current, next 스케줄 무결성 보장
  Object.keys(members).forEach(uId => {
    if (!schedules.current[uId]) schedules.current[uId] = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_TEMPLATE));
    if (!schedules.next[uId]) schedules.next[uId] = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_TEMPLATE));
  });

  // 현재 사용자 유효성 체크
  if (!members[currentUserId]) {
    currentUserId = 'me';
  }

  // 비교할 친구 유효성 체크
  const friendKeys = Object.keys(members).filter(k => k !== 'me');
  if (friendKeys.length > 0) {
    if (!members[compareFriendId]) {
      compareFriendId = friendKeys[0];
    }
  } else {
    compareFriendId = null;
  }
}

/**
 * 로컬 스토리지에 데이터 저장
 */
function saveData() {
  localStorage.setItem('wemeet_members_v2', JSON.stringify(members));
  localStorage.setItem('wemeet_schedules_v3', JSON.stringify(schedules));
  if (schedules.current) {
    localStorage.setItem('wemeet_schedules_v2', JSON.stringify(schedules.current));
  }
}

/**
 * 사이드바 셀렉터 및 상단 칩 목록 렌더링
 */
function renderMemberSelectors() {
  const dropdown = document.getElementById('user-switcher');
  const chipsContainer = document.getElementById('friends-chips-container');
  const membersBadge = document.getElementById('hero-members-badge');
  const memberKeys = Object.keys(members);

  if (membersBadge) {
    membersBadge.textContent = `참여자 ${memberKeys.length}명 매칭 중`;
  }

  // 1. 사이드바 드롭다운
  if (dropdown) {
    dropdown.innerHTML = memberKeys.map(key => `
      <option value="${key}" ${key === currentUserId ? 'selected' : ''}>
        👤 ${members[key].name} ${key === 'me' ? '(나)' : ''}
      </option>
    `).join('');
  }

  // 2. 메인 영역 칩 리스트
  if (chipsContainer) {
    chipsContainer.innerHTML = memberKeys.map(key => {
      const m = members[key];
      const isMe = key === 'me';
      const isCurrent = key === currentUserId;
      const removeBtnHtml = (!isMe && !m.isDefault) 
        ? `<button class="remove-friend-btn" data-remove-id="${key}" title="${m.name} 삭제">&times;</button>` 
        : '';

      return `
        <span class="friend-chip ${isCurrent ? 'active' : ''}" data-user-id="${key}" title="${m.name} 선택 (일정 편집 및 초기화 대상)">
          <span class="chip-dot"></span>
          <span class="chip-name">${m.name} ${isMe ? '(나)' : ''}</span>
          ${removeBtnHtml}
        </span>
      `;
    }).join('');

    // 참여 멤버 칩 클릭 이벤트 연결 (클릭 시 초록색 활성화 및 편집/초기화 대상 지정)
    chipsContainer.querySelectorAll('.friend-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (e.target.closest('.remove-friend-btn')) return;

        const selectedId = chip.getAttribute('data-user-id');
        if (selectedId) {
          currentUserId = selectedId;
          // 선택된 멤버가 친구인 경우 우측 분할 화면에도 해당 친구 표시
          if (selectedId !== 'me') {
            compareFriendId = selectedId;
          }
          renderMemberSelectors();
          renderScheduleRows();
          updateMatchingResults();
          renderHomeDashboard();

          const selUser = members[selectedId];
          const nameText = selUser.name + (selectedId === 'me' ? '(나)' : '');
          showToast(`👤 [${nameText}] 님이 선택되었습니다. (초록색 활성화)`);
        }
      });
    });

    // 친구 삭제 버튼 이벤트 연결
    chipsContainer.querySelectorAll('.remove-friend-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const removeId = btn.getAttribute('data-remove-id');
        deleteFriend(removeId);
      });
    });
  }

  // 3. 기본값 초기화 버튼 툴팁에 현재 선택된 사용자 이름 반영
  const resetBtn = document.getElementById('btn-reset-default');
  if (resetBtn) {
    const activeUser = members[currentUserId] || members.me;
    const activeName = activeUser.name + (currentUserId === 'me' ? '(나)' : '');
    resetBtn.title = `[${activeName}] 일정만 체크 해제 (초기화)`;
  }

  // 4. 분할 헤더 텍스트 및 비교 대상 셀렉터 업데이트
  updateSplitHeaderDisplay();

  // 5. 사이드바 하단 프로필 영역 업데이트
  updateCurrentProfileDisplay();
}

/**
 * 분할 헤더의 이름 및 친구 선택 드롭다운 갱신
 */
function updateSplitHeaderDisplay() {
  const meNameEl = document.getElementById('header-me-name');
  const friendNameEl = document.getElementById('header-friend-name');
  const compareSelect = document.getElementById('compare-friend-select');
  const memberKeys = Object.keys(members);
  const friendKeys = memberKeys.filter(k => k !== 'me');

  if (meNameEl && members.me) {
    meNameEl.textContent = members.me.name;
  }

  if (friendKeys.length > 0) {
    if (!members[compareFriendId]) {
      compareFriendId = friendKeys[0];
    }
    const currentFriend = members[compareFriendId] || members[friendKeys[0]];
    if (friendNameEl) {
      friendNameEl.textContent = currentFriend.name;
    }
  } else {
    compareFriendId = null;
    if (friendNameEl) {
      friendNameEl.textContent = '친구 없음';
    }
  }

  if (compareSelect) {
    if (friendKeys.length > 1) {
      compareSelect.style.display = 'inline-block';
      compareSelect.innerHTML = friendKeys.map(k => `
        <option value="${k}" ${k === compareFriendId ? 'selected' : ''}>
          ${members[k].name} 님과 비교
        </option>
      `).join('');
    } else {
      compareSelect.style.display = 'none';
    }
  }
}

/**
 * 현재 선택된 사용자 프로필 표시 갱신
 */
function updateCurrentProfileDisplay() {
  const current = members[currentUserId] || members.me;
  const avatarEl = document.getElementById('current-user-avatar');
  const nameEl = document.getElementById('current-user-name');
  const roleEl = document.getElementById('current-user-role-desc');

  if (avatarEl) avatarEl.textContent = current.initial || current.name[0];
  if (nameEl) nameEl.textContent = current.name;
  if (roleEl) roleEl.textContent = current.role || '참여자';
}

/**
 * 일주일 행 렌더링 (나 vs 친구 반으로 갈라진 분할 화면)
 */
function renderScheduleRows() {
  const container = document.getElementById('schedule-rows-container');
  if (!container) return;

  container.innerHTML = '';

  const activeDays = getActiveDays();
  const meUser = members.me || { name: '김건영' };
  const friendKeys = Object.keys(members).filter(k => k !== 'me');
  const hasFriends = friendKeys.length > 0;

  if (hasFriends && (!compareFriendId || !members[compareFriendId])) {
    compareFriendId = friendKeys[0];
  }
  const friendUser = hasFriends ? members[compareFriendId] : null;

  const currentWeekSchedules = schedules[currentWeek] || {};
  const meSchedule = currentWeekSchedules.me || {};
  const friendSchedule = (hasFriends && compareFriendId) ? (currentWeekSchedules[compareFriendId] || {}) : {};

  activeDays.forEach((day) => {
    const meDayData = meSchedule[day.id] || { lunch: false, dinner: false, jogging: false, memo: '' };
    const friendDayData = friendSchedule[day.id] || { lunch: false, dinner: false, jogging: false, memo: '' };

    // 나와 친구의 슬롯별 일치(둘 다 가능) 여부 확인
    const matchedSlots = [];
    if (hasFriends) {
      SLOTS_DATA.forEach(slot => {
        if (meDayData[slot.id] === true && friendDayData[slot.id] === true) {
          matchedSlots.push(slot.name);
        }
      });
    }

    // 현재 선택된 사용자(초록색 활성 대상) 패널 확인
    const isMeActive = currentUserId === 'me';
    const isFriendActive = hasFriends && (currentUserId === compareFriendId);

    const isAnyMatch = hasFriends && matchedSlots.length > 0;
    const isAllMatch = hasFriends && (matchedSlots.length === SLOTS_DATA.length);

    const row = document.createElement('div');
    row.className = `schedule-row split-row ${day.weekend ? 'weekend' : ''} ${isAnyMatch ? 'all-match-day' : ''} ${day.isToday ? 'today-row' : ''}`;
    row.setAttribute('data-day-id', day.id);

    // 날짜 매칭 뱃지 문구
    let matchBadgeHtml = '';
    if (!hasFriends) {
      matchBadgeHtml = `<span class="day-match-pill none">친구 등록 대기</span>`;
    } else if (isAllMatch) {
      matchBadgeHtml = `<span class="day-match-pill matched">🌟 3개 모두 일치!</span>`;
    } else if (isAnyMatch) {
      matchBadgeHtml = `<span class="day-match-pill matched">👑 ${matchedSlots.join('·')} 가능</span>`;
    } else {
      matchBadgeHtml = `<span class="day-match-pill none">시간 조율 중</span>`;
    }

    // 친구 영역 HTML 생성 (친구가 있는 경우 vs 없는 경우)
    let friendPaneHtml = '';
    if (hasFriends && friendUser) {
      friendPaneHtml = `
        <div class="split-user-pane friend-pane ${isFriendActive ? 'active-target' : ''}">
          <div class="user-pane-title">
            <span class="pane-dot friend-dot"></span>
            <span class="pane-name">${friendUser.name} (친구)</span>
            ${isFriendActive ? '<span class="pane-active-tag">선택됨 ✓</span>' : ''}
          </div>
          <div class="user-slots-grid">
            ${SLOTS_DATA.map(slot => {
              const isAvail = friendDayData[slot.id] === true;
              const isBoth = isAvail && (meDayData[slot.id] === true);
              return `
                <div class="slot-mini-block ${isBoth ? 'matched-slot' : ''}">
                  <div class="slot-mini-title">
                    <span>${slot.icon} ${slot.name}</span>
                    ${isBoth ? '<span class="match-crown-tag">👑 일치!</span>' : ''}
                  </div>
                  <div class="segmented-control" data-user="${compareFriendId}" data-day="${day.id}" data-slot="${slot.id}">
                    <button class="segment-btn ${isAvail ? 'active available' : ''}" data-action="available">
                      <i class="fa-solid fa-check"></i> 가능
                    </button>
                    <button class="segment-btn ${!isAvail ? 'active busy' : ''}" data-action="busy">
                      <i class="fa-solid fa-xmark"></i> 안됨
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          <div class="user-memo-box">
            <input 
              type="text" 
              class="pane-memo-input" 
              data-user="${compareFriendId}" 
              data-day="${day.id}" 
              value="${escapeHtml(friendDayData.memo || '')}" 
              placeholder="${friendUser.name}의 비고 메모" 
            />
          </div>
        </div>
      `;
    } else {
      friendPaneHtml = `
        <div class="split-user-pane friend-pane empty-friend-pane">
          <div class="user-pane-title">
            <span class="pane-dot friend-dot" style="background: #94a3b8;"></span>
            <span class="pane-name" style="color: #94a3b8;">비교할 친구 없음</span>
          </div>
          <div class="empty-friend-box" style="padding: 24px 12px; text-align: center; color: #94a3b8; font-size: 12px;">
            <i class="fa-solid fa-user-plus" style="font-size: 22px; color: #cbd5e1; margin-bottom: 8px; display: block;"></i>
            <span>상단의 [친구 추가]를 눌러 함께할 친구를 등록해 보세요!</span>
          </div>
        </div>
      `;
    }

    const badgeClass = day.isToday ? 'today-tag' : (day.weekend ? 'weekend-tag' : '');
    const badgeContent = day.isToday ? '<i class="fa-solid fa-clock"></i> 오늘' : day.badge;

    row.innerHTML = `
      <!-- 1. 좌측: 날짜 및 요일 -->
      <div class="date-col">
        <div class="date-header-badge-wrap">
          <span class="date-text">${day.name}</span>
          <span class="status-badge ${badgeClass}">${badgeContent}</span>
        </div>
        ${matchBadgeHtml}
      </div>

      <!-- 2. 반으로 갈라진 분할 영역 (좌: 나 / 우: 친구) -->
      <div class="split-content-container">

        <!-- [좌측 절반] 나 (김건영) -->
        <div class="split-user-pane me-pane ${isMeActive ? 'active-target' : ''}">
          <div class="user-pane-title">
            <span class="pane-dot me-dot"></span>
            <span class="pane-name">${meUser.name} (나)</span>
            ${isMeActive ? '<span class="pane-active-tag">선택됨 ✓</span>' : ''}
          </div>
          <div class="user-slots-grid">
            ${SLOTS_DATA.map(slot => {
              const isAvail = meDayData[slot.id] === true;
              const isBoth = hasFriends && isAvail && (friendDayData[slot.id] === true);
              return `
                <div class="slot-mini-block ${isBoth ? 'matched-slot' : ''}">
                  <div class="slot-mini-title">
                    <span>${slot.icon} ${slot.name}</span>
                    ${isBoth ? '<span class="match-crown-tag">👑 일치!</span>' : ''}
                  </div>
                  <div class="segmented-control" data-user="me" data-day="${day.id}" data-slot="${slot.id}">
                    <button class="segment-btn ${isAvail ? 'active available' : ''}" data-action="available">
                      <i class="fa-solid fa-check"></i> 가능
                    </button>
                    <button class="segment-btn ${!isAvail ? 'active busy' : ''}" data-action="busy">
                      <i class="fa-solid fa-xmark"></i> 안됨
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          <div class="user-memo-box">
            <input 
              type="text" 
              class="pane-memo-input" 
              data-user="me" 
              data-day="${day.id}" 
              value="${escapeHtml(meDayData.memo || '')}" 
              placeholder="내 비고 메모 (예: 저녁 7시 강남역)" 
            />
          </div>
        </div>

        <!-- [중앙 디바이더] 실시간 매칭 아이콘 -->
        <div class="split-center-divider">
          <div class="match-icon-badge ${isAnyMatch ? 'has-match' : ''}" title="${isAnyMatch ? matchedSlots.join(', ') + ' 일치!' : (hasFriends ? '시간 조율 중' : '친구 추가 필요')}">
            <i class="fa-solid ${isAnyMatch ? 'fa-check' : (hasFriends ? 'fa-arrow-right-arrow-left' : 'fa-user-clock')}"></i>
          </div>
        </div>

        <!-- [우측 절반] 친구 -->
        ${friendPaneHtml}

      </div>
    `;

    container.appendChild(row);
  });

  // 버튼 및 메모 인풋 이벤트 바인딩
  setupSegmentButtons();
  setupMemoInputs();
}

/**
 * 특정 슬롯 참여 현황 계산
 */
function getSlotParticipation(dayId, slotId) {
  const memberKeys = Object.keys(members);
  const total = memberKeys.length;
  const availableNames = [];
  const weekData = schedules[currentWeek] || {};

  memberKeys.forEach(k => {
    if (weekData[k] && weekData[k][dayId] && weekData[k][dayId][slotId]) {
      availableNames.push(members[k].name);
    }
  });

  const count = availableNames.length;

  if (count === total && total > 1) {
    return {
      isAllAvailable: true,
      statusClass: 'all-ok',
      icon: '<i class="fa-solid fa-crown" style="color: #10b981;"></i>',
      text: `전원 가능 (${total}명 모두!)`
    };
  } else if (count === 1 && total === 1) {
    return {
      isAllAvailable: true,
      statusClass: 'all-ok',
      icon: '<i class="fa-solid fa-check" style="color: #10b981;"></i>',
      text: `가능 (1명)`
    };
  } else if (count >= 1 && total > 1) {
    return {
      isAllAvailable: false,
      statusClass: 'partial',
      icon: '<i class="fa-solid fa-circle-check"></i>',
      text: `${count}명 가능 (${availableNames.join(', ')})`
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
 * 세그먼트 토글 버튼 동작 설정 (좌/우 양쪽 사용자 지원)
 */
function setupSegmentButtons() {
  const controls = document.querySelectorAll('.segmented-control');
  controls.forEach(ctrl => {
    const userId = ctrl.getAttribute('data-user') || currentUserId;
    const dayId = ctrl.getAttribute('data-day');
    const slotId = ctrl.getAttribute('data-slot');
    const btns = ctrl.querySelectorAll('.segment-btn');

    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        const isAvailable = (action === 'available');

        // 상태 저장
        if (!schedules[currentWeek]) schedules[currentWeek] = {};
        if (!schedules[currentWeek][userId]) schedules[currentWeek][userId] = {};
        if (!schedules[currentWeek][userId][dayId]) schedules[currentWeek][userId][dayId] = {};
        schedules[currentWeek][userId][dayId][slotId] = isAvailable;

        saveData();

        renderScheduleRows();
        updateMatchingResults();
        renderHomeDashboard();

        const activeDays = getActiveDays();
        const dayObj = activeDays.find(d => d.id === dayId);
        const slotObj = SLOTS_DATA.find(s => s.id === slotId);
        const userObj = members[userId] || { name: '사용자' };
        const statusText = isAvailable ? '가능' : '안됨';
        showToast(`📅 [${userObj.name}] ${dayObj?.name} ${slotObj?.name} [${statusText}]`);
      });
    });
  });
}

/**
 * 비고란 메모 입력 실시간 저장 설정 (좌/우 양쪽 사용자 지원)
 */
function setupMemoInputs() {
  const memoInputs = document.querySelectorAll('.pane-memo-input');
  memoInputs.forEach(input => {
    const userId = input.getAttribute('data-user') || currentUserId;
    const dayId = input.getAttribute('data-day');

    let saveTimeout;
    input.addEventListener('input', () => {
      const text = input.value.trim();

      if (!schedules[currentWeek]) schedules[currentWeek] = {};
      if (!schedules[currentWeek][userId]) schedules[currentWeek][userId] = {};
      if (!schedules[currentWeek][userId][dayId]) schedules[currentWeek][userId][dayId] = {};
      schedules[currentWeek][userId][dayId].memo = text;

      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveData();
      }, 300);
    });
  });
}

/**
 * 요일별 전원 일치(골든타임) 매칭 그룹 계산
 * - 한 요일에 점심/저녁/조깅 3개가 모두 가능하면 -> "[요일] 가능" (예: "일요일 가능")
 * - 2개 이상 가능하면 -> "[요일] 점심 · 저녁 가능", "[요일] 점심 · 조깅 가능" 등 나머지 활동 모두 표시
 * - 1개 가능하면 -> "[요일] [활동명] 가능" (예: "일요일 점심 가능")
 */
function getMatchedDayGroups(activeDays) {
  const groups = [];

  activeDays.forEach((day, dIdx) => {
    const matchedSlots = [];
    SLOTS_DATA.forEach(slot => {
      const stat = getSlotParticipation(day.id, slot.id);
      if (stat.isAllAvailable) {
        matchedSlots.push(slot);
      }
    });

    if (matchedSlots.length > 0) {
      const isAllDay = (matchedSlots.length === SLOTS_DATA.length); // 3개 슬롯 전원 가능
      const slotNames = matchedSlots.map(s => s.name).join(' · ');

      // 요일 한글 이름 추출 (예: "9. 13. (일)" -> "일요일")
      let dayKorean = day.name;
      if (day.name.includes('(')) {
        const start = day.name.indexOf('(') + 1;
        const end = day.name.indexOf(')');
        dayKorean = day.name.substring(start, end) + '요일';
      }

      // 사용자 요청: 일요일 점심, 저녁, 조깅 다 가능체크되면 그냥 "일요일 가능"
      let displayTitle = '';
      if (isAllDay) {
        displayTitle = `${dayKorean} 가능`;
      } else {
        displayTitle = `${dayKorean} ${slotNames} 가능`;
      }

      groups.push({
        day,
        dayIndex: dIdx,
        matchedSlots,
        isAllDay,
        slotNames,
        dayKorean,
        displayTitle,
        fullDateTitle: isAllDay ? `${day.name} 가능` : `${day.name} ${slotNames} 가능`
      });
    }
  });

  return groups;
}

/**
 * 만남 최적일 실시간 매칭 알고리즘
 */
function updateMatchingResults() {
  const activeDays = getActiveDays();
  const dayGroups = getMatchedDayGroups(activeDays);
  const totalGoldenSlots = dayGroups.reduce((acc, g) => acc + g.matchedSlots.length, 0);

  const heroTextEl = document.getElementById('hero-recommend-text');
  const heroSubEl = document.getElementById('hero-recommend-sub');
  const badgeEl = document.getElementById('match-count-badge');
  const memberCount = Object.keys(members).length;

  if (dayGroups.length > 0) {
    const summaryItems = dayGroups.map(g => {
      if (g.isAllDay) {
        return `${g.dayKorean} 가능`;
      } else {
        return `${g.dayKorean} ${g.matchedSlots.map(s => s.name).join('·')}`;
      }
    });

    if (heroTextEl) heroTextEl.textContent = summaryItems.join(' · ');
    if (heroSubEl) heroSubEl.textContent = `(참여자 ${memberCount}명 모두 가능! 총 ${totalGoldenSlots}개 골든타임)`;
    if (badgeEl) badgeEl.textContent = `${totalGoldenSlots}개 추천`;
  } else {
    const partialMatchSlots = [];
    activeDays.forEach(day => {
      SLOTS_DATA.forEach(slot => {
        const stat = getSlotParticipation(day.id, slot.id);
        if (stat.statusClass === 'partial') {
          const label = `${day.name.split(' ')[1]} ${slot.name}`;
          partialMatchSlots.push(label);
        }
      });
    });

    if (partialMatchSlots.length > 0) {
      if (heroTextEl) heroTextEl.textContent = partialMatchSlots.slice(0, 3).join(' · ');
      if (heroSubEl) heroSubEl.textContent = `(가장 많이 모일 수 있는 시간대)`;
      if (badgeEl) badgeEl.textContent = `${partialMatchSlots.length}개 가능`;
    } else {
      if (heroTextEl) heroTextEl.textContent = `시간을 조율 중입니다`;
      if (heroSubEl) heroSubEl.textContent = `가능한 시간대를 [가능]으로 체크해 보세요!`;
      if (badgeEl) badgeEl.textContent = `0개`;
    }
  }
}

/**
 * 새로운 친구 추가 로직
 */
function addNewFriend(name) {
  const cleanName = name.trim();
  if (!cleanName) {
    showToast('⚠️ 친구 이름을 입력해 주세요.');
    return;
  }

  // 중복 확인
  const isDuplicate = Object.values(members).some(m => m.name === cleanName);
  if (isDuplicate) {
    showToast('⚠️ 이미 존재하는 친구 이름입니다.');
    return;
  }

  const newId = 'friend_' + Date.now();
  const initial = cleanName[0];

  members[newId] = {
    id: newId,
    name: cleanName,
    initial: initial,
    role: '친구',
    isDefault: false
  };

  // 새 친구 기본 스케줄 초기화 (이번 주 및 다음 주)
  if (!schedules.current) schedules.current = {};
  if (!schedules.next) schedules.next = {};
  schedules.current[newId] = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_TEMPLATE));
  schedules.next[newId] = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_TEMPLATE));

  // 추가된 친구를 바로 분할 화면 비교 대상으로 지정
  compareFriendId = newId;

  saveData();

  // 뷰 갱신
  renderMemberSelectors();
  renderScheduleRows();
  updateMatchingResults();
  renderHomeDashboard();

  showToast(`🎉 새로운 친구 [${cleanName}] 님이 추가되었습니다!`);
}

/**
 * 친구 삭제 로직
 */
function deleteFriend(friendId, skipConfirm = false) {
  if (friendId === 'me') {
    showToast('⚠️ 나(김건영)는 목록에서 삭제할 수 없습니다.');
    return;
  }

  const friendName = members[friendId]?.name || '친구';
  if (!skipConfirm && !confirm(`[${friendName}] 님을 참여자 목록에서 삭제하시겠습니까?`)) {
    return;
  }

  delete members[friendId];
  if (schedules.current) delete schedules.current[friendId];
  if (schedules.next) delete schedules.next[friendId];

  if (currentUserId === friendId) {
    currentUserId = 'me';
  }

  const friendKeys = Object.keys(members).filter(k => k !== 'me');
  if (compareFriendId === friendId) {
    compareFriendId = friendKeys.length > 0 ? friendKeys[0] : null;
  }

  saveData();
  renderMemberSelectors();
  renderScheduleRows();
  updateMatchingResults();
  renderHomeDashboard();

  showToast(`🗑️ [${friendName}] 님이 참여자 목록에서 삭제되었습니다.`);
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
  // 1. 비교 대상 친구 선택 드롭다운
  const compareSelect = document.getElementById('compare-friend-select');
  if (compareSelect) {
    compareSelect.addEventListener('change', (e) => {
      compareFriendId = e.target.value;
      renderMemberSelectors();
      renderScheduleRows();
      updateMatchingResults();
      renderHomeDashboard();
      const fName = members[compareFriendId]?.name || '친구';
      showToast(`👥 [${fName}] 님과의 비교 화면으로 전환했습니다.`);
    });
  }

  // 2. 사용자 전환 셀렉터 (사이드바)
  const userSwitcher = document.getElementById('user-switcher');
  if (userSwitcher) {
    userSwitcher.addEventListener('change', (e) => {
      currentUserId = e.target.value;
      renderMemberSelectors();
      renderScheduleRows();
      renderHomeDashboard();
      const name = members[currentUserId]?.name || '선택된 사용자';
      showToast(`👤 [${name}] 님의 일정 편집 모드로 전환했습니다.`);
    });
  }

  // 2-2. 친구 추가 모달 제어
  const addFriendModal = document.getElementById('add-friend-modal');
  const addTriggerBtns = [
    document.getElementById('btn-add-friend-trigger'),
    document.getElementById('btn-add-friend-sidebar')
  ];
  const closeAddFriendBtn = document.getElementById('btn-close-add-friend');
  const cancelAddFriendBtn = document.getElementById('btn-cancel-add-friend');
  const confirmAddFriendBtn = document.getElementById('btn-confirm-add-friend');
  const friendNameInput = document.getElementById('new-friend-name');

  const openAddFriendModal = () => {
    if (addFriendModal) {
      addFriendModal.classList.add('open');
      addFriendModal.setAttribute('aria-hidden', 'false');
      if (friendNameInput) {
        friendNameInput.value = '';
        friendNameInput.focus();
      }
    }
  };

  const closeAddFriendModal = () => {
    if (addFriendModal) {
      addFriendModal.classList.remove('open');
      addFriendModal.setAttribute('aria-hidden', 'true');
    }
  };

  addTriggerBtns.forEach(btn => {
    if (btn) btn.addEventListener('click', openAddFriendModal);
  });

  if (closeAddFriendBtn) closeAddFriendBtn.addEventListener('click', closeAddFriendModal);
  if (cancelAddFriendBtn) cancelAddFriendBtn.addEventListener('click', closeAddFriendModal);

  if (confirmAddFriendBtn) {
    confirmAddFriendBtn.addEventListener('click', () => {
      if (friendNameInput) {
        addNewFriend(friendNameInput.value);
        closeAddFriendModal();
      }
    });
  }

  if (friendNameInput) {
    friendNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        addNewFriend(friendNameInput.value);
        closeAddFriendModal();
      }
    });
  }

  // 3. 기본값으로 선택된 친구/나의 일정만 초기화
  const resetBtn = document.getElementById('btn-reset-default');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const activeUser = members[currentUserId] || members.me;
      const userName = activeUser.name + (currentUserId === 'me' ? '(나)' : '');
      const weekLabel = currentWeek === 'next' ? '다음 주' : '이번 주';

      if (confirm(`선택된 [${userName}] 님의 ${weekLabel} 일정을 체크되지 않은 초기 상태로 되돌리시겠습니까?`)) {
        if (!schedules[currentWeek]) schedules[currentWeek] = {};
        if (!schedules[currentWeek][currentUserId]) schedules[currentWeek][currentUserId] = {};
        getActiveDays().forEach(d => {
          schedules[currentWeek][currentUserId][d.id] = {
            lunch: false,
            dinner: false,
            jogging: false,
            memo: ''
          };
        });

        saveData();
        renderScheduleRows();
        updateMatchingResults();
        renderHomeDashboard();
        showToast(`🔄 [${userName}] 님의 ${weekLabel} 일정이 초기화(체크 해제)되었습니다.`);
      }
    });
  }

  // 4. 주말 조깅+점심 활성화 버튼
  const weekendJoggingBtn = document.getElementById('btn-weekend-jogging');
  if (weekendJoggingBtn) {
    weekendJoggingBtn.addEventListener('click', () => {
      if (!schedules[currentWeek]) schedules[currentWeek] = {};
      if (!schedules[currentWeek][currentUserId]) schedules[currentWeek][currentUserId] = {};
      getActiveDays().forEach(d => {
        if (!schedules[currentWeek][currentUserId][d.id]) schedules[currentWeek][currentUserId][d.id] = {};
        if (d.weekend) {
          schedules[currentWeek][currentUserId][d.id].lunch = true;
          schedules[currentWeek][currentUserId][d.id].jogging = true;
          schedules[currentWeek][currentUserId][d.id].dinner = false;
        }
      });
      saveData();
      renderScheduleRows();
      updateMatchingResults();
      renderHomeDashboard();
      showToast('🏃 주말(토/일) 조깅과 점심을 [가능]으로 활성화했습니다!');
    });
  }

  // 5. 모두 가능으로 일괄 설정
  const allAvailBtn = document.getElementById('btn-all-available');
  if (allAvailBtn) {
    allAvailBtn.addEventListener('click', () => {
      if (!schedules[currentWeek]) schedules[currentWeek] = {};
      if (!schedules[currentWeek][currentUserId]) schedules[currentWeek][currentUserId] = {};
      getActiveDays().forEach(d => {
        if (!schedules[currentWeek][currentUserId][d.id]) schedules[currentWeek][currentUserId][d.id] = {};
        schedules[currentWeek][currentUserId][d.id].lunch = true;
        schedules[currentWeek][currentUserId][d.id].dinner = true;
        schedules[currentWeek][currentUserId][d.id].jogging = true;
      });
      saveData();
      renderScheduleRows();
      updateMatchingResults();
      renderHomeDashboard();
      showToast('✨ 전체 활동을 [가능]으로 일괄 설정했습니다.');
    });
  }

  // 6. 친구 초대 링크 복사
  const copyBtns = [document.getElementById('btn-copy-invite'), document.getElementById('btn-share-profile')];
  copyBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        const shareUrl = window.location.href;
        navigator.clipboard.writeText(shareUrl).then(() => {
          showToast('🔗 약속 조율 초대 링크가 복사되었습니다!');
        }).catch(() => {
          showToast('🔗 초대 링크: ' + shareUrl);
        });
      });
    }
  });

  // 7. 친구별 전체 일정표 매트릭스 모달
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

  // 8. 뷰 전환 및 주차(이번 주 / 다음 주) 전환 이벤트
  const navHome = document.getElementById('nav-home');
  const navSchedule = document.getElementById('nav-schedule');
  const navNextWeek = document.getElementById('nav-next-week');
  const btnWeekCurrent = document.getElementById('btn-week-current');
  const btnWeekNext = document.getElementById('btn-week-next');
  const btnGotoSchedule = document.getElementById('btn-goto-schedule');
  const btnDdayDetails = document.getElementById('btn-dday-details');

  if (navHome) {
    navHome.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('home');
    });
  }
  if (navSchedule) {
    navSchedule.addEventListener('click', (e) => {
      e.preventDefault();
      switchWeek('current');
      switchView('schedule');
    });
  }
  if (navNextWeek) {
    navNextWeek.addEventListener('click', (e) => {
      e.preventDefault();
      switchWeek('next');
      switchView('schedule');
    });
  }
  if (btnWeekCurrent) {
    btnWeekCurrent.addEventListener('click', () => {
      switchWeek('current');
    });
  }
  if (btnWeekNext) {
    btnWeekNext.addEventListener('click', () => {
      switchWeek('next');
    });
  }
  if (btnGotoSchedule) {
    btnGotoSchedule.addEventListener('click', () => {
      switchWeek('current');
      switchView('schedule');
    });
  }
  if (btnDdayDetails) {
    btnDdayDetails.addEventListener('click', () => {
      switchWeek('current');
      switchView('schedule');
    });
  }

  // 9. 친구 삭제 모달 제어
  const deleteFriendModal = document.getElementById('delete-friend-modal');
  const removeTriggerBtns = [
    document.getElementById('btn-remove-friend-trigger'),
    document.getElementById('btn-remove-friend-sidebar')
  ];
  const closeDeleteFriendBtn = document.getElementById('btn-close-delete-friend');
  const cancelDeleteFriendBtn = document.getElementById('btn-cancel-delete-friend');
  const confirmDeleteFriendBtn = document.getElementById('btn-confirm-delete-friend');
  const deleteFriendSelect = document.getElementById('delete-friend-select');

  const openDeleteFriendModal = () => {
    const friendKeys = Object.keys(members).filter(k => k !== 'me');
    if (friendKeys.length === 0) {
      showToast('⚠️ 삭제할 수 있는 친구가 목록에 없습니다.');
      return;
    }

    if (deleteFriendSelect) {
      deleteFriendSelect.innerHTML = friendKeys.map(k => `
        <option value="${k}" ${k === compareFriendId ? 'selected' : ''}>
          ${members[k].name} (${members[k].role || '친구'})
        </option>
      `).join('');
    }

    if (deleteFriendModal) {
      deleteFriendModal.classList.add('open');
      deleteFriendModal.setAttribute('aria-hidden', 'false');
    }
  };

  const closeDeleteFriendModal = () => {
    if (deleteFriendModal) {
      deleteFriendModal.classList.remove('open');
      deleteFriendModal.setAttribute('aria-hidden', 'true');
    }
  };

  removeTriggerBtns.forEach(btn => {
    if (btn) btn.addEventListener('click', openDeleteFriendModal);
  });

  if (closeDeleteFriendBtn) closeDeleteFriendBtn.addEventListener('click', closeDeleteFriendModal);
  if (cancelDeleteFriendBtn) cancelDeleteFriendBtn.addEventListener('click', closeDeleteFriendModal);

  if (confirmDeleteFriendBtn) {
    confirmDeleteFriendBtn.addEventListener('click', () => {
      if (deleteFriendSelect && deleteFriendSelect.value) {
        const targetId = deleteFriendSelect.value;
        closeDeleteFriendModal();
        deleteFriend(targetId, true);
      }
    });
  }

  if (deleteFriendModal) {
    deleteFriendModal.addEventListener('click', (e) => {
      if (e.target === deleteFriendModal) closeDeleteFriendModal();
    });
  }

  // 10. 위시리스트 추가 이벤트
  const btnAddWishlist = document.getElementById('btn-add-wishlist');
  const wishlistInput = document.getElementById('wishlist-input');
  const wishlistTypeSelect = document.getElementById('wishlist-type-select');

  const handleAddWishlist = () => {
    if (!wishlistInput) return;
    const text = wishlistInput.value.trim();
    const type = wishlistTypeSelect ? wishlistTypeSelect.value : 'food';
    if (!text) {
      showToast('⚠️ 가고 싶은 맛집, 러닝 코스, 놀러갈 곳 장소를 입력해 주세요.');
      wishlistInput.focus();
      return;
    }
    addWishlistItem(type, text);
    wishlistInput.value = '';
    wishlistInput.focus();
  };

  if (btnAddWishlist) {
    btnAddWishlist.addEventListener('click', handleAddWishlist);
  }
  if (wishlistInput) {
    wishlistInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAddWishlist();
    });
  }

  // 11. 위시리스트 카테고리 필터 탭 이벤트 (10개 이상 쌓였을 때 대비)
  const filterPills = document.querySelectorAll('.w-filter-pill');
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const filter = pill.getAttribute('data-filter') || 'all';
      currentWishlistFilter = filter;
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      renderWishlistGrid();
    });
  });

  // 12. 위시리스트 실시간 검색 필터 이벤트
  const searchInput = document.getElementById('wishlist-search-input');
  const searchClearBtn = document.getElementById('wishlist-search-clear');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentWishlistSearch = searchInput.value.trim();
      if (searchClearBtn) {
        if (currentWishlistSearch) {
          searchClearBtn.classList.add('show');
        } else {
          searchClearBtn.classList.remove('show');
        }
      }
      renderWishlistGrid();
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        currentWishlistSearch = '';
        searchClearBtn.classList.remove('show');
        renderWishlistGrid();
        searchInput.focus();
      }
    });
  }

  // 13. 📱 모바일 사이드바 드로어(Drawer) 및 하단 탭바 인터랙션 설정
  const btnMobileMenu = document.getElementById('btn-mobile-menu');
  const btnCloseSidebar = document.getElementById('btn-close-sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const appSidebar = document.getElementById('app-sidebar');
  const btnMobileShare = document.getElementById('btn-mobile-share');

  // 사이드바 열기 함수
  const openMobileSidebar = () => {
    if (appSidebar) appSidebar.classList.add('mobile-open');
    if (sidebarOverlay) sidebarOverlay.classList.add('active');
  };

  // 사이드바 닫기 함수
  const closeMobileSidebar = () => {
    if (appSidebar) appSidebar.classList.remove('mobile-open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
  };

  if (btnMobileMenu) btnMobileMenu.addEventListener('click', openMobileSidebar);
  if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', closeMobileSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeMobileSidebar);

  // 사이드바 메뉴 항목 클릭 시 모바일에서는 자동으로 드로어 닫기
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        closeMobileSidebar();
      }
    });
  });

  // 모바일 상단 공유 버튼 클릭 시 링크 복사
  if (btnMobileShare) {
    btnMobileShare.addEventListener('click', () => {
      const shareUrl = window.location.href;
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('🔗 약속 조율 초대 링크가 복사되었습니다!');
      }).catch(() => {
        showToast('🔗 초대 링크: ' + shareUrl);
      });
    });
  }

  // 모바일 하단 네비게이션 탭바 클릭 이벤트
  const bottomHome = document.getElementById('bottom-nav-home');
  const bottomSchedule = document.getElementById('bottom-nav-schedule');
  const bottomNextWeek = document.getElementById('bottom-nav-next-week');
  const bottomMatrix = document.getElementById('bottom-nav-matrix');
  const bottomMenu = document.getElementById('bottom-nav-menu');

  if (bottomHome) {
    bottomHome.addEventListener('click', () => {
      switchView('home');
    });
  }
  if (bottomSchedule) {
    bottomSchedule.addEventListener('click', () => {
      switchWeek('current');
      switchView('schedule');
    });
  }
  if (bottomNextWeek) {
    bottomNextWeek.addEventListener('click', () => {
      switchWeek('next');
      switchView('schedule');
    });
  }
  if (bottomMatrix) {
    bottomMatrix.addEventListener('click', openMatrix);
  }
  if (bottomMenu) {
    bottomMenu.addEventListener('click', openMobileSidebar);
  }
}

/**
 * 전체 친구 일정 및 비고 비교 매트릭스 테이블 렌더링
 */
function renderMatrixTable() {
  const table = document.getElementById('matrix-table');
  if (!table) return;

  const memberKeys = Object.keys(members);
  const activeDays = getActiveDays();
  const currentWeekSchedules = schedules[currentWeek] || {};

  let html = `
    <thead>
      <tr>
        <th>날짜</th>
        <th>활동 / 항목</th>
        ${memberKeys.map(k => `<th>${members[k].name}</th>`).join('')}
        <th>매칭 결과</th>
      </tr>
    </thead>
    <tbody>
  `;

  activeDays.forEach(day => {
    // 1. 점심, 저녁, 조깅 3행 출력
    SLOTS_DATA.forEach((slot, sIdx) => {
      const stat = getSlotParticipation(day.id, slot.id);

      html += `<tr>`;
      if (sIdx === 0) {
        // 날짜 열은 4행(슬롯 3개 + 비고 1개) 병합
        html += `<td rowspan="4" style="font-weight: 800; background: #fafafa; border-right: 1px solid #e5ebe6;">${day.name}</td>`;
      }
      html += `<td style="font-weight: 700;">${slot.icon} ${slot.name}</td>`;

      memberKeys.forEach(mKey => {
        const isAvail = currentWeekSchedules[mKey]?.[day.id]?.[slot.id];
        if (isAvail) {
          html += `<td class="cell-ok">가능</td>`;
        } else {
          html += `<td class="cell-busy">안됨</td>`;
        }
      });

      if (stat.isAllAvailable) {
        html += `<td class="cell-golden">👑 전원 확정!</td>`;
      } else {
        html += `<td>${stat.text}</td>`;
      }

      html += `</tr>`;
    });

    // 2. 비고(메모) 행 출력
    html += `<tr style="background: #fdfdfd;">`;
    html += `<td style="font-size: 11px; color: #777;">📝 비고</td>`;
    memberKeys.forEach(mKey => {
      const memo = currentWeekSchedules[mKey]?.[day.id]?.memo || '-';
      html += `<td style="font-size: 11px; color: #444; max-width: 140px; word-break: break-all;">${escapeHtml(memo)}</td>`;
    });
    html += `<td style="font-size: 11px; color: #888;">메모</td>`;
    html += `</tr>`;
  });

  html += `</tbody>`;
  table.innerHTML = html;
}

/**
 * XSS 방지 유틸
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 토스트 알림 표시 유틸
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
  }, 2400);
}

/**
 * =====================================================================
 *  [뷰 전환 및 주차 선택, 홈 라운지 대시보드 로직]
 * =====================================================================
 */

/**
 * 이번 주 / 다음 주 일정 전환 함수
 */
function switchWeek(weekKey) {
  if (!WEEKS_CONFIG[weekKey]) return;
  currentWeek = weekKey;
  const config = WEEKS_CONFIG[weekKey];

  // 1. 상단 타이틀 및 설명 업데이트
  const tagEl = document.getElementById('schedule-category-tag');
  const titleEl = document.getElementById('schedule-main-title');
  const descEl = document.getElementById('schedule-sub-desc');

  if (tagEl) tagEl.textContent = config.subTag;
  if (titleEl) titleEl.textContent = config.title;
  if (descEl) descEl.textContent = config.desc;

  updateWeekPillButtons();

  // 2. 사이드바 내비게이션 활성 상태 표시
  const navSchedule = document.getElementById('nav-schedule');
  const navNextWeek = document.getElementById('nav-next-week');
  if (navSchedule && navNextWeek) {
    if (weekKey === 'current') {
      navSchedule.classList.add('active');
      navNextWeek.classList.remove('active');
    } else {
      navSchedule.classList.remove('active');
      navNextWeek.classList.add('active');
    }
  }

  // 3. 상단 캡슐 토글 버튼 상태 표시
  const btnCurrent = document.getElementById('btn-week-current');
  const btnNext = document.getElementById('btn-week-next');
  if (btnCurrent && btnNext) {
    if (weekKey === 'current') {
      btnCurrent.classList.add('active');
      btnNext.classList.remove('active');
    } else {
      btnCurrent.classList.remove('active');
      btnNext.classList.add('active');
    }
  }

  // 4. 데이터 무결성 보장
  if (!schedules[currentWeek]) schedules[currentWeek] = {};
  Object.keys(members).forEach(uId => {
    if (!schedules[currentWeek][uId]) {
      schedules[currentWeek][uId] = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_TEMPLATE));
    }
  });

  renderScheduleRows();
  updateMatchingResults();
  renderHomeDashboard();
  updateMobileBottomNav();

  showToast(`📅 [${config.title}] 화면으로 전환되었습니다. (${config.dateRange})`);
}

/**
 * 뷰 전환 함수 (일정 화면 <-> 홈 라운지)
 */
function switchView(viewName) {
  currentView = viewName;
  const viewSchedule = document.getElementById('view-schedule');
  const viewHome = document.getElementById('view-home');
  const navSchedule = document.getElementById('nav-schedule');
  const navNextWeek = document.getElementById('nav-next-week');
  const navHome = document.getElementById('nav-home');

  if (viewName === 'home') {
    if (viewSchedule) {
      viewSchedule.classList.remove('active');
      viewSchedule.style.display = 'none';
    }
    if (viewHome) {
      viewHome.classList.add('active');
      viewHome.style.display = 'block';
    }
    if (navSchedule) navSchedule.classList.remove('active');
    if (navNextWeek) navNextWeek.classList.remove('active');
    if (navHome) navHome.classList.add('active');

    renderHomeDashboard();
    updateMobileBottomNav();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    if (viewHome) {
      viewHome.classList.remove('active');
      viewHome.style.display = 'none';
    }
    if (viewSchedule) {
      viewSchedule.classList.add('active');
      viewSchedule.style.display = 'block';
    }
    if (navHome) navHome.classList.remove('active');
    if (currentWeek === 'current') {
      if (navSchedule) navSchedule.classList.add('active');
      if (navNextWeek) navNextWeek.classList.remove('active');
    } else {
      if (navNextWeek) navNextWeek.classList.add('active');
      if (navSchedule) navSchedule.classList.remove('active');
    }

    renderScheduleRows();
    updateMobileBottomNav();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/**
 * 📱 모바일 하단 고정 탭바(Bottom Navigation) 활성 상태 동기화 함수
 */
function updateMobileBottomNav() {
  const tabHome = document.getElementById('bottom-nav-home');
  const tabSchedule = document.getElementById('bottom-nav-schedule');
  const tabNextWeek = document.getElementById('bottom-nav-next-week');

  if (!tabHome || !tabSchedule || !tabNextWeek) return;

  tabHome.classList.remove('active');
  tabSchedule.classList.remove('active');
  tabNextWeek.classList.remove('active');

  if (currentView === 'home') {
    tabHome.classList.add('active');
  } else {
    if (currentWeek === 'current') {
      tabSchedule.classList.add('active');
    } else {
      tabNextWeek.classList.add('active');
    }
  }
}

/**
 * 홈 라운지 대시보드 데이터 계산 및 렌더링 (실시간 친구 최신화 & 다음 주/이번 주 반영)
 */
function renderHomeDashboard() {
  const activeDays = getActiveDays();
  const weekConfig = WEEKS_CONFIG[currentWeek] || WEEKS_CONFIG.current;
  const friendKeys = Object.keys(members).filter(k => k !== 'me');
  const hasFriends = friendKeys.length > 0;

  if (hasFriends && (!compareFriendId || !members[compareFriendId])) {
    compareFriendId = friendKeys[0];
  }

  const friendUser = hasFriends ? members[compareFriendId] : null;
  const friendName = friendUser ? friendUser.name : '';
  const myName = members.me ? members.me.name : '김건영';

  // 1. 최우선 골든타임 D-Day 계산 (요일별 묶음 및 활동 전체 표기)
  const dayGroups = getMatchedDayGroups(activeDays);
  const totalGoldenSlots = dayGroups.reduce((acc, g) => acc + g.matchedSlots.length, 0);

  const ddayBadge = document.getElementById('home-dday-badge');
  const ddayTitle = document.getElementById('home-dday-title');
  const ddayDesc = document.getElementById('home-dday-desc');

  if (hasFriends) {
    if (dayGroups.length > 0) {
      const firstGroup = dayGroups[0];
      const today = new Date();
      const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      let ddayText = '확정 D-DAY!';

      if (firstGroup.day && firstGroup.day.dateObj) {
        const targetMidnight = new Date(firstGroup.day.dateObj.getFullYear(), firstGroup.day.dateObj.getMonth(), firstGroup.day.dateObj.getDate());
        const diffDays = Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
          ddayText = '확정 D-DAY!';
        } else if (diffDays > 0) {
          ddayText = `확정 D-${diffDays}`;
        } else {
          ddayText = '확정 (종료)';
        }
      } else {
        ddayText = `확정 D-${Math.max(1, firstGroup.dayIndex + 1)}`;
      }

      if (ddayBadge) ddayBadge.textContent = ddayText;

      // 사용자 요청: 일요일 점심, 저녁, 조깅 다 가능체크되있을 때는 그냥 "일요일 가능 확정!", 점심/조깅 등 일부 가능 시 나머지도 다 표시
      let titleText = `${firstGroup.displayTitle} 확정!`;
      if (dayGroups.length > 1) {
        titleText += ` (외 ${dayGroups.length - 1}일)`;
      }
      if (ddayTitle) ddayTitle.textContent = titleText;

      // 설명란: 가능한 모든 요일과 시간대를 빠짐없이 상세 표시
      if (ddayDesc) {
        const allSummaries = dayGroups.map(g => {
          if (g.isAllDay) {
            return `${g.day.name} [점심 · 저녁 · 조깅 전체 가능]`;
          } else {
            return `${g.day.name} [${g.slotNames}]`;
          }
        });
        ddayDesc.textContent = `${myName} 님과 ${friendName} 님이 함께 가능한 시간: ${allSummaries.join(', ')} (총 ${totalGoldenSlots}개 골든타임)`;
      }
    } else {
      if (ddayBadge) ddayBadge.textContent = '조율 중';
      if (ddayTitle) ddayTitle.textContent = '아직 전원 일치하는 일정이 없어요';
      if (ddayDesc) {
        ddayDesc.textContent = `${myName} 님과 ${friendName} 님이 함께 가능한 시간대를 [가능]으로 체크해 보세요!`;
      }
    }
  } else {
    if (ddayBadge) ddayBadge.textContent = '친구 추가 필요';
    if (ddayTitle) ddayTitle.textContent = '함께할 친구를 먼저 추가해 보세요';
    if (ddayDesc) {
      ddayDesc.textContent = '상단의 [친구 추가]를 눌러 친구를 등록하면 실시간 일정 매칭과 추천 골든타임이 계산됩니다.';
    }
  }

  // 2. 활동별 매칭률 현황 계산
  const totalDays = activeDays.length;
  let totalMatches = 0;
  const activityListEl = document.getElementById('home-activity-list');

  if (activityListEl) {
    activityListEl.innerHTML = SLOTS_DATA.map(slot => {
      let matchedCount = 0;
      activeDays.forEach(day => {
        const stat = getSlotParticipation(day.id, slot.id);
        if (stat.isAllAvailable) matchedCount++;
      });
      totalMatches += matchedCount;
      const rate = totalDays > 0 ? Math.round((matchedCount / totalDays) * 100) : 0;

      return `
        <div class="activity-match-item">
          <div class="activity-match-icon">${slot.icon}</div>
          <div class="activity-match-info">
            <div class="activity-match-name">
              <span>${slot.name} 만남</span>
              <span class="activity-match-rate-text">${matchedCount}회 가능 (${rate}%)</span>
            </div>
            <div class="activity-progress-bar">
              <div class="activity-progress-fill" style="width: ${rate}%;"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 전체 매칭률 뱃지
  const matchRateBadge = document.getElementById('home-matching-rate-badge');
  if (matchRateBadge) {
    const maxPossible = totalDays * SLOTS_DATA.length;
    const overallRate = maxPossible > 0 ? Math.round((totalMatches / maxPossible) * 100) : 0;
    matchRateBadge.textContent = `전체 일치율 ${overallRate}%`;
  }

  // 3. 케미 수치 갱신 (점심 만남, 저녁 만남, 조깅 만남, 누적 달린 거리)
  let matchedLunch = 0;
  let matchedDinner = 0;
  let matchedJogging = 0;

  activeDays.forEach(day => {
    if (getSlotParticipation(day.id, 'lunch').isAllAvailable) matchedLunch++;
    if (getSlotParticipation(day.id, 'dinner').isAllAvailable) matchedDinner++;
    if (getSlotParticipation(day.id, 'jogging').isAllAvailable) matchedJogging++;
  });

  const lunchEl = document.getElementById('stat-lunch-count');
  const dinnerEl = document.getElementById('stat-dinner-count');
  const joggingCountEl = document.getElementById('stat-jogging-count');
  const joggingKmEl = document.getElementById('stat-jogging-km');

  if (lunchEl) lunchEl.textContent = `${matchedLunch}회`;
  if (dinnerEl) dinnerEl.textContent = `${matchedDinner}회`;
  if (joggingCountEl) joggingCountEl.textContent = `${matchedJogging}회`;
  if (joggingKmEl) joggingKmEl.textContent = `${matchedJogging * 5}km`;

  // 4. 케미 팁 텍스트 동적 실시간 최신화
  const tipEl = document.getElementById('home-chemistry-tip-text');
  if (tipEl) {
    if (!hasFriends) {
      tipEl.textContent = '현재 참여 중인 친구가 없습니다. [친구 추가]를 눌러 친구와 일정을 공유해 보세요!';
    } else if (dayGroups.length > 0) {
      const best = dayGroups[0];
      const slotDetail = best.isAllDay ? '종일(점심·저녁·조깅)' : best.slotNames;
      tipEl.innerHTML = `<strong>${myName}</strong> 님과 <strong>${friendName}</strong> 님은 <strong>${best.dayKorean} ${slotDetail}</strong>에서 가장 궁합이 좋아요!`;
    } else if (matchedJogging > 0 || matchedLunch > 0 || matchedDinner > 0) {
      const topActivity = (matchedLunch >= matchedDinner && matchedLunch >= matchedJogging) ? '점심 식사' : (matchedDinner >= matchedJogging ? '저녁 모임' : '조깅 러닝');
      tipEl.innerHTML = `<strong>${myName}</strong> 님과 <strong>${friendName}</strong> 님은 <strong>${topActivity}</strong> 활동에서 높은 케미를 보이고 있어요!`;
    } else {
      tipEl.innerHTML = `<strong>${myName}</strong> 님과 <strong>${friendName}</strong> 님의 일정을 조율 중입니다. 가능한 시간대를 선택해보세요!`;
    }
  }

  // 5. 위시리스트 렌더링
  renderWishlistGrid();
}

/**
 * =====================================================================
 *  [위시리스트 (맛집, 러닝코스, 놀러갈 곳) 로컬 스토리지 관리]
 * =====================================================================
 */
const DEFAULT_WISHLIST = [
  { id: 1, type: 'food', name: '강남역 정돈 돈까스 (점심 추천)', date: '2026.09.10' },
  { id: 2, type: 'run', name: '반포 한강공원 달빛광장 5km 야간 러닝', date: '2026.09.10' },
  { id: 3, type: 'play', name: '롯데월드 어드벤처 & 석촌호수 산책', date: '2026.09.10' },
  { id: 4, type: 'food', name: '성수동 블루보틀 커피 & 디저트', date: '2026.09.10' }
];

let currentWishlistFilter = 'all';
let currentWishlistSearch = '';

function getWishlistData() {
  const saved = localStorage.getItem('wemeet_wishlist_v1');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return DEFAULT_WISHLIST;
    }
  }
  return DEFAULT_WISHLIST;
}

function saveWishlistData(list) {
  localStorage.setItem('wemeet_wishlist_v1', JSON.stringify(list));
}

function renderWishlistGrid() {
  const container = document.getElementById('wishlist-items-grid');
  if (!container) return;

  const list = getWishlistData();

  // 1. 카테고리별 개수 뱃지 갱신 (10개 이상 대비)
  const countAll = list.length;
  const countFood = list.filter(i => i.type === 'food').length;
  const countRun = list.filter(i => i.type === 'run').length;
  const countPlay = list.filter(i => i.type === 'play').length;
  const countEtc = list.filter(i => i.type === 'etc').length;

  const elAll = document.getElementById('w-count-all');
  const elFood = document.getElementById('w-count-food');
  const elRun = document.getElementById('w-count-run');
  const elPlay = document.getElementById('w-count-play');
  const elEtc = document.getElementById('w-count-etc');

  if (elAll) elAll.textContent = countAll;
  if (elFood) elFood.textContent = countFood;
  if (elRun) elRun.textContent = countRun;
  if (elPlay) elPlay.textContent = countPlay;
  if (elEtc) elEtc.textContent = countEtc;

  // 2. 전체 데이터가 없는 경우
  if (list.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 28px; color: var(--text-muted); font-size: 13px;">
        <i class="fa-solid fa-bookmark" style="font-size: 24px; color: #cbd5e1; margin-bottom: 8px; display: block;"></i>
        아직 등록된 위시리스트가 없습니다. 상단에서 가고 싶은 맛집, 러닝 코스, 놀러갈 곳을 적어보세요!
      </div>
    `;
    return;
  }

  // 3. 필터 및 검색 적용
  let filteredList = list;

  if (currentWishlistFilter !== 'all') {
    filteredList = filteredList.filter(item => item.type === currentWishlistFilter);
  }

  if (currentWishlistSearch) {
    const q = currentWishlistSearch.toLowerCase();
    filteredList = filteredList.filter(item => item.name.toLowerCase().includes(q));
  }

  if (filteredList.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 28px; color: var(--text-muted); font-size: 13px;">
        <i class="fa-solid fa-magnifying-glass" style="font-size: 22px; color: #cbd5e1; margin-bottom: 8px; display: block;"></i>
        검색 및 필터 조건에 일치하는 장소가 없습니다.
      </div>
    `;
    return;
  }

  const typeConfig = {
    food: { label: '🥪 맛집/카페', class: 'food' },
    run: { label: '🏃 러닝코스', class: 'run' },
    play: { label: '🎡 놀러갈 곳', class: 'play' },
    etc: { label: '✨ 기타 장소', class: 'etc' }
  };

  container.innerHTML = filteredList.map(item => {
    const conf = typeConfig[item.type] || typeConfig.food;
    return `
      <div class="wishlist-card">
        <div class="wishlist-card-top">
          <span class="wishlist-category-tag ${conf.class}">${conf.label}</span>
          <button class="wishlist-delete-btn" data-wishlist-id="${item.id}" title="삭제">&times;</button>
        </div>
        <div class="wishlist-card-text">${escapeHtml(item.name)}</div>
        <div class="wishlist-card-footer">
          <span><i class="fa-regular fa-clock"></i> ${item.date}</span>
          <span>함께 가기</span>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.wishlist-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-wishlist-id');
      deleteWishlistItem(id);
    });
  });
}

function addWishlistItem(type, name) {
  const list = getWishlistData();
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  const newItem = {
    id: Date.now(),
    type: type || 'food',
    name: name.trim(),
    date: dateStr
  };
  list.unshift(newItem);
  saveWishlistData(list);
  renderWishlistGrid();
  showToast(`📌 위시리스트에 [${name}] 항목이 추가되었습니다!`);
}

function deleteWishlistItem(id) {
  let list = getWishlistData();
  list = list.filter(item => String(item.id) !== String(id));
  saveWishlistData(list);
  renderWishlistGrid();
  showToast(`🗑️ 위시리스트 항목이 삭제되었습니다.`);
}

/**
 * =====================================================================
 *  🔒 프라이빗 4자리 비밀번호 잠금 게이트웨이 로직 (PIN: 0987)
 * =====================================================================
 */
const APP_PIN = '0987';
const PIN_STORAGE_KEY = 'wemeet_unlocked_v1';

function initPasswordGate() {
  const overlay = document.getElementById('password-gate-overlay');
  const form = document.getElementById('gate-pin-form');
  const input = document.getElementById('gate-pin-input');
  const errorMsg = document.getElementById('gate-error-msg');
  if (!overlay || !input) return;

  function unlockGate(fromUrl) {
    localStorage.setItem(PIN_STORAGE_KEY, 'true');
    overlay.classList.add('unlocked');
    if (fromUrl) {
      showToast('🔑 인증 링크로 자동 입장되었습니다.');
    } else {
      showToast('🔓 인증되었습니다. 환영합니다!');
    }
  }

  // 1. URL 쿼리 파라미터 프리패스 체크 (예: ?pin=0987 또는 ?key=0987)
  const urlParams = new URLSearchParams(window.location.search);
  const paramPin = urlParams.get('pin') || urlParams.get('key');
  if (paramPin === APP_PIN) {
    unlockGate(true);
    return;
  }

  // 2. 이미 브라우저(localStorage)에 인증되어 있는지 체크
  const isUnlocked = localStorage.getItem(PIN_STORAGE_KEY) === 'true';
  if (isUnlocked) {
    overlay.classList.add('unlocked');
    return;
  }

  // 3. 비밀번호 검증 핸들러
  const handleUnlock = () => {
    const val = input.value.trim();
    if (val === APP_PIN) {
      unlockGate(false);
    } else {
      input.classList.add('error');
      if (errorMsg) {
        errorMsg.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> 비밀번호가 일치하지 않습니다.';
      }
      input.value = '';
      input.focus();
      setTimeout(() => input.classList.remove('error'), 400);
    }
  };

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleUnlock();
    });
  }

  // 4자리 입력 시 자동 확인
  input.addEventListener('input', () => {
    if (input.value.length === 4) {
      handleUnlock();
    }
  });

  // 초기 포커스
  setTimeout(() => input.focus(), 200);
}
