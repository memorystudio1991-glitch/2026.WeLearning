/**
 * =====================================================================
 *  [메인 애플리케이션 로직: app.js]
 * =====================================================================
 *  - products.js 데이터를 기반으로 동적 렌더링
 *  - '아울렛 브랜드 세일' 배너 클릭 시 전용 특가 기획전 팝업 창 오픈
 *  - 외부 사이트 새 창 연결 (target="_blank", rel="noopener noreferrer")
 *  - 실시간 카운트다운 타이머, 쿠폰 다운로드, 부드러운 스크롤 & 토스트 알림
 * =====================================================================
 */

let countdownInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  renderCategories();
  initScrollTop();
  initGuideModal();
  initOutletSaleModal();
});

/**
 * 카테고리별 섹션 및 상품 렌더링 함수
 */
function renderCategories() {
  const container = document.getElementById('categories-container');
  if (!container || typeof CATEGORY_DATA === 'undefined') return;

  container.innerHTML = '';

  CATEGORY_DATA.forEach((category) => {
    const section = document.createElement('section');
    section.className = 'category-block';
    section.setAttribute('data-category-id', category.id);

    // 카테고리 내부 행 구조
    section.innerHTML = `
      <div class="category-row">
        <!-- 1. 좌측 카테고리 정보 및 HOT 키워드 -->
        <div class="category-sidebar">
          <a href="${category.categoryUrl || '#none'}" target="_blank" rel="noopener noreferrer" class="cat-heading-link" title="${category.name} 전체보기">
            <h3 class="cat-title" style="color: ${category.themeColor}">${category.name}</h3>
            <span class="cat-sublink">바로가기 &gt;</span>
          </a>

          <div class="hot-keyword-section">
            <div class="hot-keyword-title">HOT키워드</div>
            <div class="keyword-list">
              ${category.keywords.map(kw => `
                <a href="${kw.url}" target="_blank" rel="noopener noreferrer" class="keyword-tag" style="color: ${category.themeColor}" title="${kw.text} 검색결과 보기">
                  ${kw.text}
                </a>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- 2. 중앙 대형 프로모션 배너 (누르면 아울렛 브랜드 세일 창 오픈) -->
        <div class="hero-banner-col">
          <div class="hero-banner-card" data-category-id="${category.id}" title="${category.featuredBanner.badgeTitle} 세일 기획전 보기" role="button" tabindex="0">
            <div class="banner-click-prompt">
              <i class="fa-solid fa-fire"></i> 세일 기획전 보기
            </div>
            <img src="${category.featuredBanner.image}" alt="${category.name} 프로모션 배너" class="hero-banner-img" loading="lazy" />
            <div class="hero-banner-overlay" style="background-color: ${category.themeColor}">
              <div class="banner-badge-title">${category.featuredBanner.badgeTitle}</div>
              <div class="banner-badge-subtitle">${category.featuredBanner.badgeSubtitle}</div>
            </div>
          </div>
          <!-- 하단 페이지네이션 닷 -->
          <div class="banner-dots">
            ${Array.from({ length: category.featuredBanner.dotsCount || 6 }).map((_, i) => `
              <span class="dot ${i === (category.featuredBanner.activeDotIndex || 0) ? 'active' : ''}"></span>
            `).join('')}
          </div>
        </div>

        <!-- 3. 우측 상품 3열x2행 그리드 -->
        <div class="products-grid-col">
          <div class="products-grid">
            ${category.products.map(product => createProductCardHtml(product)).join('')}
          </div>
          <!-- 상품 그리드 하단 닷 인디케이터 -->
          <div class="grid-dots">
            <span class="dot active"></span>
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
      </div>
    `;

    container.appendChild(section);
  });

  // 배너 클릭 시 아울렛 세일 팝업 창 연결
  setupBannerClickEvents();

  // 모든 외부 연결 링크 클릭 시 부드러운 토스트 안내
  setupLinkClickInteractions();
}

/**
 * 개별 상품 카드 HTML 생성
 */
function createProductCardHtml(product) {
  // 쿠폰할인 배지
  const couponHtml = product.badge 
    ? `<div class="coupon-badge">${product.badge}</div>` 
    : '';

  // 로켓배송 / 판매자로켓 배지 렌더링
  let deliveryHtml = '';
  if (product.rocketBadge) {
    const isSellerRocket = product.rocketBadge.includes('판매자로켓');
    const badgeTypeClass = isSellerRocket ? 'seller-rocket' : 'rocket';
    const mainText = isSellerRocket ? '판매자로켓' : '로켓배송';

    deliveryHtml = `
      <div class="delivery-badge-wrap ${badgeTypeClass}">
        <span class="rocket-icon">🚀</span>
        <span class="delivery-text">${mainText}</span>
        <span class="next-day-pill">내일</span>
      </div>
    `;
  }

  return `
    <a href="${product.targetUrl}" 
       target="_blank" 
       rel="noopener noreferrer" 
       class="product-card" 
       data-title="${escapeHtml(product.title)}"
       title="${escapeHtml(product.title)}">
      <div class="product-thumb-wrap">
        <img src="${product.image}" alt="${escapeHtml(product.title)}" class="product-thumb" loading="lazy" />
      </div>
      <div class="product-info">
        <div class="product-title">${product.title}</div>
        ${couponHtml}
        <div class="product-price-row">
          <span class="product-price">${product.price}</span>
          ${deliveryHtml}
        </div>
      </div>
    </a>
  `;
}

/**
 * 대형 배너 클릭 시 "아울렛 브랜드 세일 창" 오픈 연결
 */
function setupBannerClickEvents() {
  const bannerCards = document.querySelectorAll('.hero-banner-card');
  bannerCards.forEach(card => {
    const clickHandler = () => {
      const categoryId = card.getAttribute('data-category-id') || 'women';
      openOutletModal(categoryId);
    };

    card.addEventListener('click', clickHandler);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        clickHandler();
      }
    });
  });
}

/**
 * 🔥 아울렛 브랜드 세일 팝업 창 열기 함수
 */
function openOutletModal(categoryId) {
  const modal = document.getElementById('outlet-sale-modal');
  if (!modal || typeof CATEGORY_DATA === 'undefined') return;

  const category = CATEGORY_DATA.find(c => c.id === categoryId) || CATEGORY_DATA[0];
  const saleData = category.outletSaleModal || {
    title: category.featuredBanner.badgeTitle,
    subtitle: category.featuredBanner.badgeSubtitle,
    themeColor: category.themeColor,
    badgeText: "SPECIAL SALE",
    remainingDays: 7,
    couponText: "선착순 추가할인 쿠폰 받기",
    allPromotionUrl: category.featuredBanner.targetUrl,
    saleItems: []
  };

  // 1. 헤더 및 타이틀 업데이트
  const badgeEl = document.getElementById('outlet-badge-tag');
  const titleEl = document.getElementById('outlet-main-title');
  const subTitleEl = document.getElementById('outlet-sub-title');
  const couponTextEl = document.getElementById('outlet-coupon-text');
  const allLinkEl = document.getElementById('outlet-all-link');
  const itemsContainer = document.getElementById('outlet-items-grid');

  if (badgeEl) {
    badgeEl.textContent = saleData.badgeText || 'OUTLET SPECIAL';
    badgeEl.style.backgroundColor = saleData.themeColor || category.themeColor;
  }
  if (titleEl) titleEl.textContent = saleData.title;
  if (subTitleEl) subTitleEl.textContent = saleData.subtitle;
  if (couponTextEl) couponTextEl.textContent = saleData.couponText;
  
  if (allLinkEl) {
    allLinkEl.href = saleData.allPromotionUrl || category.featuredBanner.targetUrl;
    allLinkEl.setAttribute('data-title', saleData.title + ' 공식 기획전');
  }

  // 2. 특가 상품 리스트 렌더링
  if (itemsContainer && saleData.saleItems) {
    itemsContainer.innerHTML = saleData.saleItems.map(item => `
      <a href="${item.targetUrl}" target="_blank" rel="noopener noreferrer" class="outlet-item-card" data-title="${escapeHtml(item.title)}">
        <div class="outlet-thumb-wrap">
          <img src="${item.image}" alt="${escapeHtml(item.title)}" class="outlet-thumb-img" loading="lazy" />
          <span class="outlet-item-badge" style="background-color: ${saleData.themeColor}">${item.badge || '특가'}</span>
        </div>
        <div class="outlet-item-info">
          <div class="outlet-brand-name">${item.brand || 'BRAND'}</div>
          <div class="outlet-item-title">${item.title}</div>
          <div class="outlet-price-row">
            <span class="outlet-discount" style="color: ${saleData.themeColor}">${item.discount}</span>
            <span class="outlet-final-price">${item.price}</span>
            <span class="outlet-orig-price">${item.originalPrice}</span>
          </div>
          <div class="outlet-item-action">
            특가 구매하기 <i class="fa-solid fa-chevron-right"></i>
          </div>
        </div>
      </a>
    `).join('');

    // 내부 상품 클릭 시에도 토스트 안내 연결
    itemsContainer.querySelectorAll('.outlet-item-card').forEach(card => {
      card.addEventListener('click', () => {
        const title = card.getAttribute('data-title') || '특가 상품';
        showToast(`🔗 [${title}] 구매 페이지로 이동합니다 (새 창)`);
      });
    });
  }

  // 3. 실시간 카운트다운 타이머 시작
  startOutletCountdown(saleData.remainingDays || 6);

  // 4. 모달 표시
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden'; // 배경 스크롤 방지

  showToast(`🎉 [${saleData.title}] 기획전 창이 열렸습니다!`);
}

/**
 * 실시간 카운트다운 타이머 로직
 */
function startOutletCountdown(daysLeft) {
  clearInterval(countdownInterval);

  // 현재 시간 기준 마감 타깃 시간 설정 (daysLeft 일 뒤)
  const targetTime = Date.now() + (daysLeft * 24 * 60 * 60 * 1000) + (18 * 60 * 60 * 1000);

  function updateTimer() {
    const now = Date.now();
    const diff = Math.max(0, targetTime - now);

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    const pad = (n) => String(n).padStart(2, '0');

    const daysEl = document.getElementById('timer-days');
    const hoursEl = document.getElementById('timer-hours');
    const minsEl = document.getElementById('timer-mins');
    const secsEl = document.getElementById('timer-secs');

    if (daysEl) daysEl.textContent = pad(days);
    if (hoursEl) hoursEl.textContent = pad(hours);
    if (minsEl) minsEl.textContent = pad(mins);
    if (secsEl) secsEl.textContent = pad(secs);
  }

  updateTimer();
  countdownInterval = setInterval(updateTimer, 1000);
}

/**
 * 아울렛 모달 닫기 및 쿠폰 다운로드 이벤트 초기화
 */
function initOutletSaleModal() {
  const modal = document.getElementById('outlet-sale-modal');
  const closeBtn = document.getElementById('close-outlet-modal-btn');
  const couponBtn = document.getElementById('coupon-claim-btn');

  if (!modal) return;

  const closeModal = () => {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    clearInterval(countdownInterval);
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  // 배경 클릭 시 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // ESC 키로 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeModal();
    }
  });

  // 쿠폰 다운로드 클릭 시
  if (couponBtn) {
    couponBtn.addEventListener('click', () => {
      couponBtn.textContent = '발급 완료 ✓';
      couponBtn.style.backgroundColor = '#10b981';
      showToast('🎟️ 아울렛 전용 15% 중복할인 쿠폰이 발급되었습니다!');
    });
  }
}

/**
 * 링크 클릭 시 사용자 피드백 안내
 */
function setupLinkClickInteractions() {
  const cards = document.querySelectorAll('.product-card, .keyword-tag, #outlet-all-link');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const title = card.getAttribute('data-title') || card.innerText.trim() || '선택하신 상품';
      showToast(`🔗 [${title}] 연결 페이지로 이동합니다 (새 창)`);
    });
  });
}

/**
 * 토스트 알림창 표시
 */
let toastTimeout;
function showToast(message) {
  const toast = document.getElementById('toast-message');
  if (!toast) return;

  toast.innerHTML = `<i class="fa-solid fa-arrow-up-right-from-square"></i> ${message}`;
  toast.classList.add('show');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}

/**
 * 맨 위로 스크롤 버튼 제어
 */
function initScrollTop() {
  const topBtn = document.getElementById('scroll-top-btn');
  if (!topBtn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 250) {
      topBtn.classList.add('visible');
    } else {
      topBtn.classList.remove('visible');
    }
  });

  topBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

/**
 * 링크 수정 안내 모달 제어
 */
function initGuideModal() {
  const modal = document.getElementById('guide-modal');
  const triggerBtn = document.getElementById('guide-modal-btn');
  const closeBtn = document.getElementById('close-modal-btn');
  const okBtn = document.getElementById('modal-ok-btn');
  const previewContainer = document.getElementById('current-links-list');

  if (!modal || !triggerBtn) return;

  // 현재 설정된 상품 링크 미리보기 렌더링
  if (previewContainer && typeof CATEGORY_DATA !== 'undefined') {
    let previewHtml = '';
    CATEGORY_DATA.forEach(cat => {
      cat.products.slice(0, 3).forEach(p => {
        previewHtml += `
          <div class="preview-link-item">
            <span style="max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <strong>[${cat.name}]</strong> ${p.title}
            </span>
            <a href="${p.targetUrl}" target="_blank" rel="noopener noreferrer">
              링크 열기 <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          </div>
        `;
      });
    });
    previewContainer.innerHTML = previewHtml;
  }

  const openModal = () => {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  };

  const closeModal = () => {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  };

  triggerBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (okBtn) okBtn.addEventListener('click', closeModal);

  // 모달 배경 클릭 시 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // ESC 키 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeModal();
    }
  });
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
