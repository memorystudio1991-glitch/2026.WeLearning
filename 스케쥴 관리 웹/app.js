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

// 1. 요일 메타데이터 (월~일 7일)
const DAYS_DATA = [
  { id: 'mon', name: '9. 7. (월)', badge: '일근', weekend: false, confirmAlert: false },
  { id: 'tue', name: '9. 8. (화)', badge: '일근', weekend: false, confirmAlert: false },
  { id: 'wed', name: '9. 9. (수)', badge: '일근', weekend: false, confirmAlert: false },
  { id: 'thu', name: '9. 10. (목)', badge: '일근', weekend: false, confirmAlert: true }, // 확인 배지
  { id: 'fri', name: '9. 11. (금)', badge: '일근', weekend: false, confirmAlert: false },
  { id: 'sat', name: '9. 12. (토)', badge: '주말', weekend: true, confirmAlert: false },
  { id: 'sun', name: '9. 13. (일)', badge: '주말', weekend: true, confirmAlert: false }
];

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
  me: {
    mon: { lunch: true, dinner: false, jogging: false, memo: '퇴근 후 휴식' },
    tue: { lunch: true, dinner: false, jogging: true, memo: '아침 7시 한강 가벼운 러닝' },
    wed: { lunch: true, dinner: false, jogging: false, memo: '' },
    thu: { lunch: true, dinner: false, jogging: false, memo: '사내 미팅 예정' },
    fri: { lunch: true, dinner: true, jogging: false, memo: '저녁 7시 약속 가능!' },
    sat: { lunch: true, dinner: true, jogging: true, memo: '오전 조깅 후 점심 브런치' },
    sun: { lunch: true, dinner: false, jogging: true, memo: '오전 8시 공원 조깅' }
  },
  friend1: {
    mon: { lunch: true, dinner: false, jogging: false, memo: '' },
    tue: { lunch: true, dinner: false, jogging: false, memo: '' },
    wed: { lunch: false, dinner: false, jogging: false, memo: '외근 일정' },
    thu: { lunch: true, dinner: false, jogging: false, memo: '' },
    fri: { lunch: true, dinner: true, jogging: false, memo: '금요일 저녁 강남역 근처 가능' },
    sat: { lunch: true, dinner: true, jogging: true, memo: '주말 언제든 환영!' },
    sun: { lunch: false, dinner: false, jogging: true, memo: '아침 운동만 가능' }
  }
};

// 앱 상태 변수
let currentUserId = 'me';
let members = {};
let schedules = {};

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  renderMemberSelectors();
  renderScheduleRows();
  updateMatchingResults();
  setupEventListeners();
});

/**
 * 로컬 스토리지에서 데이터 로드
 */
function loadData() {
  const savedMembers = localStorage.getItem('wemeet_members_v2');
  const savedSchedules = localStorage.getItem('wemeet_schedules_v2');

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
      schedules = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_TEMPLATE));
    }
  } else {
    schedules = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_TEMPLATE));
  }

  // 현재 사용자 유효성 체크
  if (!members[currentUserId]) {
    currentUserId = 'me';
  }
}

/**
 * 로컬 스토리지에 데이터 저장
 */
function saveData() {
  localStorage.setItem('wemeet_members_v2', JSON.stringify(members));
  localStorage.setItem('wemeet_schedules_v2', JSON.stringify(schedules));
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
        <span class="friend-chip ${isCurrent ? 'active' : ''}">
          <span class="chip-dot"></span>
          ${m.name} ${isMe ? '(나)' : ''}
          ${removeBtnHtml}
        </span>
      `;
    }).join('');

    // 친구 삭제 버튼 이벤트 연결
    chipsContainer.querySelectorAll('.remove-friend-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const removeId = btn.getAttribute('data-remove-id');
        deleteFriend(removeId);
      });
    });
  }

  // 3. 사이드바 하단 프로필 영역 업데이트
  updateCurrentProfileDisplay();
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
 * 일주일 행 렌더링 (점심, 저녁, 조깅 + 비고란)
 */
function renderScheduleRows() {
  const container = document.getElementById('schedule-rows-container');
  if (!container) return;

  container.innerHTML = '';
  const mySchedule = schedules[currentUserId] || {};

  DAYS_DATA.forEach((day) => {
    const dayData = mySchedule[day.id] || { lunch: true, dinner: false, jogging: false, memo: '' };
    
    // 점심, 저녁, 조깅 참여 통계 계산
    const slotStats = {
      lunch: getSlotParticipation(day.id, 'lunch'),
      dinner: getSlotParticipation(day.id, 'dinner'),
      jogging: getSlotParticipation(day.id, 'jogging')
    };

    // 어느 한 활동이라도 전원 가능하면 황금 행 하이라이트
    const isAnyAllMatch = Object.values(slotStats).some(s => s.isAllAvailable);

    const row = document.createElement('div');
    row.className = `schedule-row ${day.weekend ? 'weekend' : ''} ${isAnyAllMatch ? 'all-match-day' : ''}`;
    row.setAttribute('data-day-id', day.id);

    row.innerHTML = `
      <div class="schedule-row-main">
        <!-- 1. 날짜 및 요일 -->
        <div class="date-col">
          <span class="date-text">${day.name}</span>
          <span class="status-badge ${day.weekend ? 'weekend-tag' : ''}">${day.badge}</span>
        </div>

        <!-- 2. 점심, 저녁, 조깅 3개 슬롯 -->
        <div class="slots-col">
          ${SLOTS_DATA.map(slot => {
            const isAvail = dayData[slot.id] === true;
            const stat = slotStats[slot.id];
            const alertBadge = (slot.id === 'dinner' && day.confirmAlert) 
              ? '<span class="confirm-alert-badge">확인</span>' 
              : '';

            return `
              <div class="slot-block">
                <div class="slot-header ${slot.isJogging ? 'jogging-header' : ''}">
                  <span class="slot-icon">${slot.icon}</span>
                  <span>${slot.name}</span>
                  ${alertBadge}
                </div>
                <div class="segmented-control" data-day="${day.id}" data-slot="${slot.id}">
                  <button class="segment-btn ${isAvail ? 'active available' : ''}" data-action="available">
                    <i class="fa-solid fa-check"></i> 가능
                  </button>
                  <button class="segment-btn ${!isAvail ? 'active busy' : ''}" data-action="busy">
                    안 함
                  </button>
                </div>
                <div class="slot-friends-status ${stat.statusClass}">
                  ${stat.icon} ${stat.text}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 3. 비고란 (메모 입력 필드) -->
      <div class="memo-container">
        <label class="memo-label" for="memo-${day.id}">
          <i class="fa-regular fa-pen-to-square"></i> 비고 (메모):
        </label>
        <div class="memo-input-wrap">
          <input 
            type="text" 
            id="memo-${day.id}" 
            class="memo-input" 
            data-day="${day.id}"
            value="${escapeHtml(dayData.memo || '')}" 
            placeholder="약속 장소나 메모를 입력하세요 (예: 강남역 저녁 7시, 아침 6시 한강 조깅)" 
          />
          <span class="memo-saved-indicator" id="saved-indicator-${day.id}">저장됨 ✓</span>
        </div>
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

  memberKeys.forEach(k => {
    if (schedules[k] && schedules[k][dayId] && schedules[k][dayId][slotId]) {
      availableNames.push(members[k].name);
    }
  });

  const count = availableNames.length;

  if (count === total && total > 0) {
    return {
      isAllAvailable: true,
      statusClass: 'all-ok',
      icon: '<i class="fa-solid fa-crown" style="color: #10b981;"></i>',
      text: `전원 가능 (${total}명 모두!)`
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
 * 세그먼트 토글 버튼 동작 설정
 */
function setupSegmentButtons() {
  const controls = document.querySelectorAll('.segmented-control');
  controls.forEach(ctrl => {
    const dayId = ctrl.getAttribute('data-day');
    const slotId = ctrl.getAttribute('data-slot');
    const btns = ctrl.querySelectorAll('.segment-btn');

    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        const isAvailable = (action === 'available');

        // 상태 저장
        if (!schedules[currentUserId]) schedules[currentUserId] = {};
        if (!schedules[currentUserId][dayId]) schedules[currentUserId][dayId] = {};
        schedules[currentUserId][dayId][slotId] = isAvailable;

        saveData();

        renderScheduleRows();
        updateMatchingResults();

        const dayObj = DAYS_DATA.find(d => d.id === dayId);
        const slotObj = SLOTS_DATA.find(s => s.id === slotId);
        const statusText = isAvailable ? '가능' : '안 함';
        showToast(`📅 ${dayObj?.name} ${slotObj?.name}을 [${statusText}]으로 설정했습니다.`);
      });
    });
  });
}

/**
 * 비고란 메모 입력 실시간 저장 설정
 */
function setupMemoInputs() {
  const memoInputs = document.querySelectorAll('.memo-input');
  memoInputs.forEach(input => {
    const dayId = input.getAttribute('data-day');
    const indicator = document.getElementById(`saved-indicator-${dayId}`);

    let saveTimeout;
    input.addEventListener('input', () => {
      const text = input.value.trim();

      if (!schedules[currentUserId]) schedules[currentUserId] = {};
      if (!schedules[currentUserId][dayId]) schedules[currentUserId][dayId] = {};
      schedules[currentUserId][dayId].memo = text;

      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveData();
        if (indicator) {
          indicator.classList.add('show');
          setTimeout(() => indicator.classList.remove('show'), 1500);
        }
      }, 300);
    });
  });
}

/**
 * 만남 최적일 실시간 매칭 알고리즘
 */
function updateMatchingResults() {
  const allMatchSlots = [];
  const partialMatchSlots = [];

  DAYS_DATA.forEach(day => {
    SLOTS_DATA.forEach(slot => {
      const stat = getSlotParticipation(day.id, slot.id);
      const label = `${day.name.split(' ')[1]} ${slot.name}`;

      if (stat.isAllAvailable) {
        allMatchSlots.push(label);
      } else if (stat.statusClass === 'partial') {
        partialMatchSlots.push(label);
      }
    });
  });

  const heroTextEl = document.getElementById('hero-recommend-text');
  const heroSubEl = document.getElementById('hero-recommend-sub');
  const badgeEl = document.getElementById('match-count-badge');
  const memberCount = Object.keys(members).length;

  if (allMatchSlots.length > 0) {
    if (heroTextEl) heroTextEl.textContent = allMatchSlots.join(' · ');
    if (heroSubEl) heroSubEl.textContent = `(참여자 ${memberCount}명 모두 가능!)`;
    if (badgeEl) badgeEl.textContent = `${allMatchSlots.length}개 추천`;
  } else if (partialMatchSlots.length > 0) {
    if (heroTextEl) heroTextEl.textContent = partialMatchSlots.slice(0, 3).join(' · ');
    if (heroSubEl) heroSubEl.textContent = `(가장 많이 모일 수 있는 시간대)`;
    if (badgeEl) badgeEl.textContent = `${partialMatchSlots.length}개 가능`;
  } else {
    if (heroTextEl) heroTextEl.textContent = `시간을 조율 중입니다`;
    if (heroSubEl) heroSubEl.textContent = `가능한 시간대를 [가능]으로 체크해 보세요!`;
    if (badgeEl) badgeEl.textContent = `0개`;
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

  // 새 친구 기본 스케줄 초기화
  schedules[newId] = {};
  DAYS_DATA.forEach(d => {
    schedules[newId][d.id] = {
      lunch: true,
      dinner: false,
      jogging: d.weekend ? true : false,
      memo: ''
    };
  });

  saveData();

  // 뷰 갱신
  renderMemberSelectors();
  renderScheduleRows();
  updateMatchingResults();

  showToast(`🎉 새로운 친구 [${cleanName}] 님이 추가되었습니다!`);
}

/**
 * 친구 삭제 로직
 */
function deleteFriend(friendId) {
  const friendName = members[friendId]?.name || '친구';
  if (!confirm(`[${friendName}] 님을 참여자 목록에서 삭제하시겠습니까?`)) {
    return;
  }

  delete members[friendId];
  delete schedules[friendId];

  if (currentUserId === friendId) {
    currentUserId = 'me';
  }

  saveData();
  renderMemberSelectors();
  renderScheduleRows();
  updateMatchingResults();

  showToast(`🗑️ [${friendName}] 님이 목록에서 삭제되었습니다.`);
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
  // 1. 사용자 전환 셀렉터
  const userSwitcher = document.getElementById('user-switcher');
  if (userSwitcher) {
    userSwitcher.addEventListener('change', (e) => {
      currentUserId = e.target.value;
      renderMemberSelectors();
      renderScheduleRows();
      const name = members[currentUserId]?.name || '선택된 사용자';
      showToast(`👤 [${name}] 님의 일정 편집 모드로 전환했습니다.`);
    });
  }

  // 2. 친구 추가 모달 제어
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

  // 3. 기본값으로 재설정
  const resetBtn = document.getElementById('btn-reset-default');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('현재 일정을 기본값으로 되돌리시겠습니까?')) {
        schedules[currentUserId] = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_TEMPLATE[currentUserId] || DEFAULT_SCHEDULE_TEMPLATE.me));
        saveData();
        renderScheduleRows();
        updateMatchingResults();
        showToast('🔄 기본 일정으로 재설정되었습니다.');
      }
    });
  }

  // 4. 주말 조깅+점심 활성화 버튼
  const weekendJoggingBtn = document.getElementById('btn-weekend-jogging');
  if (weekendJoggingBtn) {
    weekendJoggingBtn.addEventListener('click', () => {
      DAYS_DATA.forEach(d => {
        if (!schedules[currentUserId][d.id]) schedules[currentUserId][d.id] = {};
        if (d.weekend) {
          schedules[currentUserId][d.id].lunch = true;
          schedules[currentUserId][d.id].jogging = true;
          schedules[currentUserId][d.id].dinner = false;
        }
      });
      saveData();
      renderScheduleRows();
      updateMatchingResults();
      showToast('🏃 주말(토/일) 조깅과 점심을 [가능]으로 활성화했습니다!');
    });
  }

  // 5. 모두 가능으로 일괄 설정
  const allAvailBtn = document.getElementById('btn-all-available');
  if (allAvailBtn) {
    allAvailBtn.addEventListener('click', () => {
      DAYS_DATA.forEach(d => {
        if (!schedules[currentUserId][d.id]) schedules[currentUserId][d.id] = {};
        schedules[currentUserId][d.id].lunch = true;
        schedules[currentUserId][d.id].dinner = true;
        schedules[currentUserId][d.id].jogging = true;
      });
      saveData();
      renderScheduleRows();
      updateMatchingResults();
      showToast('✨ 일주일 전체 활동을 [가능]으로 일괄 설정했습니다.');
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
}

/**
 * 전체 친구 일정 및 비고 비교 매트릭스 테이블 렌더링
 */
function renderMatrixTable() {
  const table = document.getElementById('matrix-table');
  if (!table) return;

  const memberKeys = Object.keys(members);

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

  DAYS_DATA.forEach(day => {
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
        const isAvail = schedules[mKey]?.[day.id]?.[slot.id];
        if (isAvail) {
          html += `<td class="cell-ok">가능</td>`;
        } else {
          html += `<td class="cell-busy">불가</td>`;
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
      const memo = schedules[mKey]?.[day.id]?.memo || '-';
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
