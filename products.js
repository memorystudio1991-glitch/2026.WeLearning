/**
 * =====================================================================
 *  [상품 및 연결 링크 설정 파일: products.js]
 * =====================================================================
 *  누르면 이동할 외부 사이트 주소(targetUrl)를 아래에서 자유롭게 수정하실 수 있습니다.
 *  - 쿠팡 파트너스 링크, 스마트스토어, 자사 쇼핑몰, 블로그 등 어떤 URL이든 연결 가능합니다.
 *  - '아울렛 브랜드 세일' 배너를 누르면 뜨는 기획전 팝업 창의 상품 및 링크도 여기서 수정 가능합니다.
 * =====================================================================
 */

const CATEGORY_DATA = [
  {
    id: "women",
    name: "여성패션",
    themeColor: "#e6007e", // 핑크 포인트 컬러
    categoryUrl: "https://www.coupang.com/np/categories/186764", // 카테고리 바로가기 링크
    keywords: [
      { text: "#원피스", url: "https://www.coupang.com/np/search?q=원피스" },
      { text: "#블라우스/셔츠", url: "https://www.coupang.com/np/search?q=블라우스+셔츠" },
      { text: "#티셔츠", url: "https://www.coupang.com/np/search?q=여성+티셔츠" },
      { text: "#스커트", url: "https://www.coupang.com/np/search?q=스커트" },
      { text: "#스니커즈", url: "https://www.coupang.com/np/search?q=여성+스니커즈" },
      { text: "#가방", url: "https://www.coupang.com/np/search?q=여성+가방" }
    ],
    featuredBanner: {
      image: "images/women_hero.jpg",
      badgeTitle: "아울렛 브랜드 세일 ~50%",
      badgeSubtitle: "단, 7일 스페셜 특가!",
      targetUrl: "https://www.coupang.com/np/campaigns/outlets", // 배너 클릭 시 이동할 기본 사이트
      dotsCount: 6,
      activeDotIndex: 0
    },
    // 🔥 "아울렛 브랜드 세일" 클릭 시 열리는 특별 세일 창 데이터
    outletSaleModal: {
      title: "아울렛 브랜드 세일 ~50%",
      subtitle: "단 7일간 진행되는 시즌오프 프리미엄 여성 브랜드 스페셜 기획전!",
      themeColor: "#e6007e",
      badgeText: "OUTLET SPECIAL",
      remainingDays: 6,
      couponText: "선착순 15% 추가할인 쿠폰 받기",
      allPromotionUrl: "https://www.coupang.com/np/campaigns/outlets",
      saleItems: [
        {
          id: "outlet-w-1",
          brand: "SEASON OFF",
          title: "프리미엄 레이스 롱 슬리브 블라우스 & 스커트 세트",
          originalPrice: "128,000원",
          price: "64,000원",
          discount: "50%",
          badge: "50% 특가",
          image: "images/women_hero.jpg",
          targetUrl: "https://www.coupang.com/vp/products/outlet-lace-set"
        },
        {
          id: "outlet-w-2",
          brand: "DAILY BASIC",
          title: "리데일리 30수 순면 반팔 티셔츠 3컬러 멀티팩",
          originalPrice: "24,000원",
          price: "12,000원",
          discount: "50%",
          badge: "한정수량",
          image: "images/w_yellow_tshirt.jpg",
          targetUrl: "https://www.coupang.com/vp/products/outlet-tshirt"
        },
        {
          id: "outlet-w-3",
          brand: "JEWELRY STUDIO",
          title: "14K 골드 체인 구슬 레이어드 팔찌 컬렉션",
          originalPrice: "38,000원",
          price: "19,000원",
          discount: "50%",
          badge: "인기폭발",
          image: "images/w_bracelet.jpg",
          targetUrl: "https://www.coupang.com/vp/products/outlet-bracelet"
        },
        {
          id: "outlet-w-4",
          brand: "SUMMER BREEZE",
          title: "도트 와이드 밴딩 쿨팬츠 & 린넨 셔츠 코디세트",
          originalPrice: "35,000원",
          price: "17,500원",
          discount: "50%",
          badge: "MD추천",
          image: "images/w_dot_pants.jpg",
          targetUrl: "https://www.coupang.com/vp/products/outlet-pants"
        }
      ]
    },
    products: [
      {
        id: "w-1",
        title: "리데일리 남여공용 30수 라운드넥 반팔 티셔츠",
        price: "5,890원",
        originalPrice: "9,900원",
        discount: "40%",
        badge: null,
        rocketBadge: null,
        image: "images/w_yellow_tshirt.jpg",
        targetUrl: "https://www.coupang.com/vp/products/sample-tshirt"
      },
      {
        id: "w-2",
        title: "하본리 여성 도트 와이드 밴딩 팬츠 시원한 쿨 바지",
        price: "8,800원",
        originalPrice: "15,000원",
        discount: "41%",
        badge: "쿠폰할인",
        rocketBadge: "판매자로켓 | 내일",
        image: "images/w_dot_pants.jpg",
        targetUrl: "https://www.coupang.com/vp/products/sample-pants"
      },
      {
        id: "w-3",
        title: "리얼국산 100% (5족) 남성 발가락 덧신 5족SET 발가락양말 항균 탈취",
        price: "15,900원",
        originalPrice: "19,900원",
        discount: "20%",
        badge: null,
        rocketBadge: "판매자로켓 | 내일",
        image: "images/w_socks.jpg",
        targetUrl: "https://www.coupang.com/vp/products/sample-socks"
      },
      {
        id: "w-4",
        title: "보누베리 골드 체인 구슬 팔찌 데일리 레이어드",
        price: "18,000원",
        originalPrice: "25,000원",
        discount: "28%",
        badge: "쿠폰할인",
        rocketBadge: "판매자로켓 | 내일",
        image: "images/w_bracelet.jpg",
        targetUrl: "https://www.coupang.com/vp/products/sample-bracelet"
      },
      {
        id: "w-5",
        title: "미디미 메쉬 단색 무지 데일리 스포츠 워터파크 야구 모자, 블랙",
        price: "5,500원",
        originalPrice: "10,000원",
        discount: "45%",
        badge: null,
        rocketBadge: "로켓배송 | 내일",
        image: "images/w_cap.jpg",
        targetUrl: "https://www.coupang.com/vp/products/sample-cap"
      },
      {
        id: "w-6",
        title: "베베니즈 여아용 심플 백리본 스커트 원피스 반팔",
        price: "23,430원",
        originalPrice: "29,000원",
        discount: "19%",
        badge: null,
        rocketBadge: "로켓배송 | 내일",
        image: "images/w_blue_dress.jpg",
        targetUrl: "https://www.coupang.com/vp/products/sample-dress"
      }
    ]
  },
  {
    id: "men",
    name: "남성패션",
    themeColor: "#0073e9", // 블루 포인트 컬러
    categoryUrl: "https://www.coupang.com/np/categories/187069",
    keywords: [
      { text: "#맨투맨", url: "https://www.coupang.com/np/search?q=남성+맨투맨" },
      { text: "#슬랙스", url: "https://www.coupang.com/np/search?q=남성+슬랙스" },
      { text: "#바람막이", url: "https://www.coupang.com/np/search?q=남성+바람막이" },
      { text: "#운동화", url: "https://www.coupang.com/np/search?q=남성+운동화" },
      { text: "#백팩", url: "https://www.coupang.com/np/search?q=남성+백팩" },
      { text: "#캐리어", url: "https://www.coupang.com/np/search?q=여행용+캐리어" }
    ],
    featuredBanner: {
      image: "images/men_hero.jpg",
      badgeTitle: "맨즈 트렌드 컬렉션 2026",
      badgeSubtitle: "인기 캐주얼 & 스트릿 최대 60% OFF",
      targetUrl: "https://www.coupang.com/np/campaigns/men-trend",
      dotsCount: 6,
      activeDotIndex: 0
    },
    // 남성패션 배너 클릭 시 열리는 특별 세일 창 데이터
    outletSaleModal: {
      title: "맨즈 트렌드 컬렉션 2026",
      subtitle: "트렌디한 남성 아우터 & 캐주얼 스트릿 브랜드 시즌 마감 특가전!",
      themeColor: "#0073e9",
      badgeText: "MEN'S SPECIAL",
      remainingDays: 5,
      couponText: "남성패션 전용 10,000원 할인 쿠폰 받기",
      allPromotionUrl: "https://www.coupang.com/np/campaigns/men-trend",
      saleItems: [
        {
          id: "outlet-m-1",
          brand: "ACTIVE GEAR",
          title: "액티브 윈드브레이커 기능성 경량 방풍 집업 자켓",
          originalPrice: "58,000원",
          price: "29,000원",
          discount: "50%",
          badge: "50% 특가",
          image: "images/m_jacket.jpg",
          targetUrl: "https://www.coupang.com/vp/products/outlet-jacket"
        },
        {
          id: "outlet-m-2",
          brand: "LUMIÈRE TRAVEL",
          title: "프리미엄 초경량 하드쉘 24인치 캐리어 기획전",
          originalPrice: "98,000원",
          price: "49,900원",
          discount: "49%",
          badge: "베스트셀러",
          image: "images/m_luggage.jpg",
          targetUrl: "https://www.coupang.com/vp/products/outlet-luggage"
        },
        {
          id: "outlet-m-3",
          brand: "URBAN NOMAD",
          title: "생활방수 비즈니스 백팩 노트북 15.6인치 수납",
          originalPrice: "69,000원",
          price: "34,500원",
          discount: "50%",
          badge: "한정수량",
          image: "images/m_backpack.jpg",
          targetUrl: "https://www.coupang.com/vp/products/outlet-backpack"
        },
        {
          id: "outlet-m-4",
          brand: "STREET SNEAKERS",
          title: "클래식 화이트 레더 데일리 로우탑 스니커즈",
          originalPrice: "84,000원",
          price: "42,000원",
          discount: "50%",
          badge: "MD추천",
          image: "images/m_sneakers.jpg",
          targetUrl: "https://www.coupang.com/vp/products/outlet-sneakers"
        }
      ]
    },
    products: [
      {
        id: "m-1",
        title: "루미에르 프리미엄 초경량 하드쉘 캐리어 여행용 캐리어 24인치",
        price: "49,900원",
        originalPrice: "89,000원",
        discount: "44%",
        badge: "특가세일",
        rocketBadge: "로켓배송 | 내일",
        image: "images/m_luggage.jpg",
        targetUrl: "https://www.coupang.com/vp/products/sample-luggage"
      },
      {
        id: "m-2",
        title: "액티브 윈드브레이커 남성 기능성 경량 집업 트랙 자켓",
        price: "28,900원",
        originalPrice: "45,000원",
        discount: "36%",
        badge: "쿠폰할인",
        rocketBadge: "판매자로켓 | 내일",
        image: "images/m_jacket.jpg",
        targetUrl: "https://www.coupang.com/vp/products/sample-jacket"
      },
      {
        id: "m-3",
        title: "노마드 어반 비즈니스 방수 백팩 노트북 가방 15.6인치 수납",
        price: "34,500원",
        originalPrice: "52,000원",
        discount: "33%",
        badge: "베스트",
        rocketBadge: "로켓배송 | 내일",
        image: "images/m_backpack.jpg",
        targetUrl: "https://www.coupang.com/vp/products/sample-backpack"
      },
      {
        id: "m-4",
        title: "클래식 스니커즈 캐주얼 로우탑 남성 화이트 레더 운동화",
        price: "42,000원",
        originalPrice: "65,000원",
        discount: "35%",
        badge: null,
        rocketBadge: "로켓배송 | 내일",
        image: "images/m_sneakers.jpg",
        targetUrl: "https://www.coupang.com/vp/products/sample-sneakers"
      },
      {
        id: "m-5",
        title: "앵커밀스 코튼 피케 카라 반팔 폴로 티셔츠 그레이",
        price: "19,800원",
        originalPrice: "29,000원",
        discount: "31%",
        badge: "쿠폰할인",
        rocketBadge: "판매자로켓 | 내일",
        image: "images/m_polo.jpg",
        targetUrl: "https://www.coupang.com/vp/products/sample-polo"
      },
      {
        id: "m-6",
        title: "리얼국산 100% (5족) 남성 발가락 덧신 5족SET 발가락양말 항균",
        price: "15,900원",
        originalPrice: "19,900원",
        discount: "20%",
        badge: null,
        rocketBadge: "판매자로켓 | 내일",
        image: "images/w_socks.jpg",
        targetUrl: "https://www.coupang.com/vp/products/sample-socks"
      }
    ]
  }
];
