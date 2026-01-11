// ============================================================================
// ⚙️ 설정 및 데이터 정의 (사용자 정의 규칙)
// ============================================================================
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwtNgxVvbew4bDfAw0ALpwAsgI5lp6p8Tvy_D7MWRXh-kluSI8C4kwCiSXA_p4uBXYi/exec'; 

// [신규] 썸네일 없을 때 사용할 기본 이미지 (어두운 배경 + 재생버튼)
const DEFAULT_THUMBNAIL = 'https://placehold.co/600x400/1a1a1a/333333?text=%E2%96%B6';

// 1. 아카이브 그룹 정의 (서브 탭 -> 태그들)
const CATEGORY_GROUPS = {
    '무대 모음집': ['콘서트', '페스티벌', '해외투어', '킹덤', '버스킹', '음방', '커버', '쇼케이스', '뮤비'],
    '라이브 모음집': ['우얘합', '하루의마무리', '라이브'],
    '투샷 모음집': ['인스타그램', '릴스', '셀카', '투샷'],
    '메시지 모음집': ['프롬혚쾌', '혚쾌버블'],
    '자체컨텐츠 모음집': ['승캠', '레코딩로그', '합주일지', '만년썰전', '엔킷리스트', '버킷리스트', '메이킹', '비하인드'],
    '미디어 모음집': ['공식 SNS', '예능', '인터뷰', '팬싸', '퇴근길', '방송', '공식컨텐츠'], 
    '백업 모음집': ['직캠', '백업'] 
};

// 2. 뉴비 키워드 정의
const NEWBIE_COLLECTIONS = [
    { id: '커플템', name: '커플템' }, 
    { id: '이마키스', name: '이마키스' }, 
    { id: '질투', name: '질투' }, 
    { id: '친지마', name: '친지마' }, 
    { id: '모음집', name: '모음집' }
];

// 3. 입덕가이드 등 기타 정의
const MUST_READ_KEYWORDS = ['입덕가이드', '연말결산', '월드컵'];

// 역방향 매핑 (카테고리 -> 그룹 찾기용)
let REVERSE_LOOKUP = {};
function buildReverseLookup() {
    for (const [group, tags] of Object.entries(CATEGORY_GROUPS)) {
        tags.forEach(tag => REVERSE_LOOKUP[tag] = group);
    }
}
buildReverseLookup();


// ============================================================================
// 📦 상태 변수
// ============================================================================
let allData = [];      
let filteredData = []; 
let displayCount = 20; 

// 현재 선택 상태
let currentMainTab = 'archive'; // must-read, newbie, archive, calendar
let currentSubGroup = 'All';    // 무대 모음집 등 (All은 전체보기)
let currentTag = 'All';         // 콘서트, 페스티벌 등

let searchQuery = '';
let sortOrder = 'latest';
let calendarDate = new Date(); 

// DOM 요소
const loadingOverlay = document.getElementById('loading-overlay');
const top10List = document.getElementById('top10-list');
const contentGrid = document.getElementById('content-grid');
const subGroupList = document.getElementById('sub-group-list');
const tagFilterContainer = document.getElementById('tag-filter-container');
const tagFilterList = document.getElementById('tag-filter-list');
const loadMoreBtn = document.getElementById('load-more-btn');
const resultCount = document.getElementById('result-count');
const noResults = document.getElementById('no-results');

// ============================================================================
// 🚀 초기화 & 데이터 로드
// ============================================================================
window.onload = async () => {
    lucide.createIcons();
    initCalendarControls(); // 캘린더 드롭다운 생성
    await fetchData();
    initEventListeners();
};

async function fetchData() {
    try {
        const response = await fetch(GAS_URL);
        const responseData = await response.json(); // 1. 일단 전체 응답을 받습니다.
        
        // ✨ [핵심 수정 부분] 
        // 응답 안에 'data'라는 상자가 있으면 꺼내 쓰고(새 방식), 
        // 없으면 그냥 씁니다(옛날 방식 - 안전장치).
        const rawJson = responseData.data ? responseData.data : responseData;
        
        allData = rawJson.map(item => {
            const link = item['링크'] || item['link'] || '';
            let thumbnail = item['썸네일'] || item['thumbnail'] || '';
            
            // 1. 유튜브 썸네일 자동 추출 시도
            if (!thumbnail && link.includes('youtu')) {
                const vidId = link.split('v=')[1]?.split('&')[0] || link.split('/').pop();
                thumbnail = `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`;
            }

            // 2. [추가됨] 여전히 썸네일이 비어있으면 기본 이미지 사용
            if (!thumbnail) {
                thumbnail = DEFAULT_THUMBNAIL;
            }

            const category = (item['카테고리'] || item['category'] || '기타').trim();

            // 데이터 분류 로직
            let assignedMainTab = 'archive';
            let assignedGroup = '기타';

            // 뉴비 키워드 포함 여부 확인
            const matchedNewbie = NEWBIE_COLLECTIONS.find(n => category.includes(n.id));

            if (MUST_READ_KEYWORDS.includes(category)) {
                assignedMainTab = 'must-read';
                assignedGroup = category; 
            } else if (matchedNewbie) {
                assignedMainTab = 'newbie';
                assignedGroup = matchedNewbie.id;
            } else if (REVERSE_LOOKUP[category]) {
                assignedMainTab = 'archive';
                assignedGroup = REVERSE_LOOKUP[category];
            } else {
                assignedMainTab = 'archive';
                assignedGroup = '기타';
            }

            return {
                title: item['제목'] || item['title'] || '제목 없음',
                date: formatDate(item['날짜'] || item['date']), 
                link: link,
                category: category, 
                mainTab: assignedMainTab,
                subGroup: assignedGroup,
                keyword: item['키워드'] || item['keyword'] || '',         
                viewCount: parseInt(item['조회수'] || item['viewCount'] || 0), 
                thumbnail: thumbnail
            };
        }).filter(item => item.title !== '제목 없음'); 

        renderTop10();
        switchMainTab('archive'); // 초기 탭

    } catch (error) {
        console.error("데이터 로드 실패:", error);
        loadingOverlay.innerHTML = `<div class="text-center text-red-500">데이터 로드 실패</div>`;
    } finally {
        setTimeout(() => loadingOverlay.classList.add('hidden'), 500);
    }
}

function formatDate(rawDate) {
    if (!rawDate) return '';
    const date = new Date(rawDate);
    if (isNaN(date.getTime())) return rawDate; 
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ============================================================================
// 🖱️ 클릭 이벤트 핸들러 (조회수 증가 로직)
// ============================================================================
function handleCardClick(link) {
    window.open(link, '_blank');
    fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'increment_view', link: link })
    }).then(() => console.log("조회수 증가 요청 전송 완료"))
      .catch(e => console.error("전송 실패", e));
}

// ============================================================================
// 🎨 UI 렌더링 로직
// ============================================================================

// 1. 메인 탭 전환
function switchMainTab(tabName) {
    currentMainTab = tabName;
    currentSubGroup = 'All';
    currentTag = 'All';
    displayCount = 20;

    document.querySelectorAll('.main-tab-btn').forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.remove('tab-inactive');
            btn.classList.add('tab-active');
        } else {
            btn.classList.remove('tab-active');
            btn.classList.add('tab-inactive');
        }
    });

    const archiveView = document.getElementById('archive-view');
    const calendarView = document.getElementById('calendar-view');
    const filterContainer = document.getElementById('filter-container');

    if (tabName === 'calendar') {
        archiveView.classList.add('hidden');
        filterContainer.classList.add('hidden');
        calendarView.classList.remove('hidden');
        renderCalendar();
    } else {
        calendarView.classList.add('hidden');
        archiveView.classList.remove('hidden');
        filterContainer.classList.remove('hidden');
        
        renderSubGroups(); 
        renderTags();      
        applyFilters();    
    }
}

// 2. 서브 그룹 렌더링
function renderSubGroups() {
    let groups = [];
    
    if (currentMainTab === 'archive') {
        groups = Object.keys(CATEGORY_GROUPS);
    } else if (currentMainTab === 'newbie') {
        groups = NEWBIE_COLLECTIONS.map(item => item.id);
    } else if (currentMainTab === 'must-read') {
        groups = MUST_READ_KEYWORDS;
    }

    let html = `
        <button class="px-4 py-2 rounded-full text-sm font-bold transition ${currentSubGroup === 'All' ? 'bg-[#2a2a2a] text-white border border-gray-500' : 'text-gray-400 hover:text-white hover:bg-[#2a2a2a]'}"
            onclick="setSubGroup('All')">
            전체 보기
        </button>
    `;

    groups.forEach(group => {
        const isActive = currentSubGroup === group;
        html += `
            <button class="px-4 py-2 rounded-full text-sm font-bold transition ${isActive ? 'bg-[#2a2a2a] text-white border border-gray-500' : 'text-gray-400 hover:text-white hover:bg-[#2a2a2a]'}"
                onclick="setSubGroup('${group}')">
                ${group}
            </button>
        `;
    });

    subGroupList.innerHTML = html;
}

function setSubGroup(group) {
    currentSubGroup = group;
    currentTag = 'All'; 
    renderSubGroups();  
    renderTags();       
    applyFilters();
}

// 3. 태그 렌더링
function renderTags() {
    if (currentMainTab !== 'archive' || currentSubGroup === 'All') {
        tagFilterContainer.classList.add('hidden');
        return;
    }

    const tags = CATEGORY_GROUPS[currentSubGroup] || [];
    if (tags.length === 0) {
        tagFilterContainer.classList.add('hidden');
        return;
    }

    tagFilterContainer.classList.remove('hidden');
    tagFilterList.innerHTML = tags.map(tag => `
        <button class="px-3 py-1 rounded-full text-xs border transition ${currentTag === tag ? 'bg-red-600 border-red-600 text-white font-bold' : 'bg-transparent border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'}"
            onclick="setTag('${tag}')">
            ${tag}
        </button>
    `).join('');
}

function setTag(tag) {
    currentTag = (currentTag === tag) ? 'All' : tag;
    renderTags();
    applyFilters();
}

// 4. 데이터 필터링 및 결과 렌더링
function applyFilters() {
    filteredData = allData.filter(item => {
        if (item.mainTab !== currentMainTab) return false;
        if (currentSubGroup !== 'All') {
            if (currentMainTab === 'archive') {
                if (item.subGroup !== currentSubGroup) return false;
            } else {
                if (item.category !== currentSubGroup && item.subGroup !== currentSubGroup) return false;
            }
        }
        if (currentTag !== 'All') {
            if (item.category !== currentTag) return false;
        }
        const matchSearch = !searchQuery || 
            item.title.toLowerCase().includes(searchQuery) || 
            item.date.includes(searchQuery);

        return matchSearch;
    });

    if (sortOrder === 'latest') filteredData.sort((a, b) => b.date.localeCompare(a.date));
    else if (sortOrder === 'oldest') filteredData.sort((a, b) => a.date.localeCompare(b.date));
    else if (sortOrder === 'views') filteredData.sort((a, b) => b.viewCount - a.viewCount);

    resultCount.innerText = `전체 ${filteredData.length}개`;
    renderGrid();
}

function renderGrid() {
    contentGrid.innerHTML = '';
    
    if (filteredData.length === 0) {
        noResults.classList.remove('hidden');
        loadMoreBtn.classList.add('hidden');
        return;
    }
    noResults.classList.add('hidden');

    const showList = filteredData.slice(0, displayCount);
    
    contentGrid.innerHTML = showList.map(item => `
        <div onclick="handleCardClick('${item.link}')" class="group cursor-pointer bg-[#181818] rounded-md overflow-hidden hover:scale-[1.02] transition duration-300 shadow-md hover:shadow-xl hover:z-10 relative">
            <div class="aspect-video bg-gray-900 relative overflow-hidden">
                <img src="${item.thumbnail}" onerror="this.src='${DEFAULT_THUMBNAIL}'" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" loading="lazy">
                <div class="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                     <i class="fas fa-eye text-[9px]"></i> ${item.viewCount.toLocaleString()}
                </div>
            </div>
            <div class="p-3">
                <div class="flex items-center justify-between mb-1.5">
                    <span class="text-[10px] font-bold text-red-500 border border-red-500/50 px-1.5 py-0.5 rounded truncate max-w-[70%]">${item.category}</span>
                    <span class="text-[10px] text-gray-500">${item.date}</span>
                </div>
                <h3 class="text-xs md:text-sm font-bold text-gray-200 line-clamp-2 leading-snug group-hover:text-white transition">${item.title}</h3>
            </div>
        </div>
    `).join('');

    if (displayCount < filteredData.length) loadMoreBtn.classList.remove('hidden');
    else loadMoreBtn.classList.add('hidden');
}

// 5. TOP 10
function renderTop10() {
    const topData = [...allData].sort((a, b) => b.viewCount - a.viewCount).slice(0, 10);
    top10List.innerHTML = topData.map((item, index) => {
        const rank = index + 1;
        const rankColorClass = 'text-white';

        return `
            <div onclick="handleCardClick('${item.link}')" class="flex-shrink-0 group cursor-pointer flex items-end relative pl-4 snap-start">
                <span class="ranking-number ${rankColorClass} absolute bottom-[-10px] left-0 md:left-2 italic font-black">${rank}</span>
                
                <div class="w-36 md:w-52 aspect-[2/3] bg-zinc-800 rounded-lg overflow-hidden shadow-lg relative z-20 ml-6 md:ml-8 transition-transform duration-300 group-hover:scale-105 border border-zinc-800 group-hover:border-gray-500">
                    <img src="${item.thumbnail}" onerror="this.src='${DEFAULT_THUMBNAIL}'" class="w-full h-full object-cover" loading="lazy">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                    </div>
            </div>
        `;
    }).join('');
}

// ============================================================================
// 6. 캘린더 (수정됨: 커스텀 드롭다운 적용)
// ============================================================================

// [수정됨] 캘린더 컨트롤 (커스텀 드롭다운 UI 적용)
function initCalendarControls() {
    const titleEl = document.getElementById('calendar-title');
    
    // 1. 연도 리스트 생성
    const currentYear = new Date().getFullYear();
    let yearListHTML = '';
    for(let y = 2017; y <= currentYear + 1; y++) {
        yearListHTML += `<div onclick="selectYear(${y})" class="px-4 py-2 hover:bg-red-600 hover:text-white cursor-pointer transition text-left text-sm text-gray-300">${y}</div>`;
    }

    // 2. 월 리스트 생성
    let monthListHTML = '';
    for(let m = 1; m <= 12; m++) {
        monthListHTML += `<div onclick="selectMonth(${m-1})" class="px-4 py-2 hover:bg-red-600 hover:text-white cursor-pointer transition text-left text-sm text-gray-300">${String(m).padStart(2,'0')}</div>`;
    }

    // 3. HTML 주입 (드롭다운 구조)
    titleEl.innerHTML = `
        <div class="flex items-center justify-center gap-2 select-none relative z-30">
            <div class="relative">
                <button onclick="toggleDropdown('year-dd')" id="btn-year" class="text-3xl font-black text-white hover:text-red-500 transition flex items-center gap-1">
                    ${calendarDate.getFullYear()} <i class="fas fa-caret-down text-sm align-middle opacity-50"></i>
                </button>
                <div id="year-dd" class="hidden absolute top-full left-0 mt-2 w-24 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto no-scrollbar z-50">
                    ${yearListHTML}
                </div>
            </div>

            <span class="text-2xl font-black text-gray-600">.</span>

            <div class="relative">
                <button onclick="toggleDropdown('month-dd')" id="btn-month" class="text-3xl font-black text-white hover:text-red-500 transition flex items-center gap-1">
                    ${String(calendarDate.getMonth() + 1).padStart(2,'0')} <i class="fas fa-caret-down text-sm align-middle opacity-50"></i>
                </button>
                <div id="month-dd" class="hidden absolute top-full left-0 mt-2 w-20 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto no-scrollbar z-50">
                    ${monthListHTML}
                </div>
            </div>
        </div>
    `;

    // 외부 클릭 시 드롭다운 닫기
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#calendar-title')) {
            const ydd = document.getElementById('year-dd');
            const mdd = document.getElementById('month-dd');
            if(ydd) ydd.classList.add('hidden');
            if(mdd) mdd.classList.add('hidden');
        }
    });
}

// [신규] 드롭다운 토글 함수
function toggleDropdown(id) {
    const target = document.getElementById(id);
    const all = ['year-dd', 'month-dd'];
    
    // 다른 건 닫기
    all.forEach(ddId => {
        const el = document.getElementById(ddId);
        if(ddId !== id && el) el.classList.add('hidden');
    });

    // 타겟 토글
    if(target) target.classList.toggle('hidden');
}

// [신규] 연도 선택
function selectYear(year) {
    calendarDate.setFullYear(year);
    // 버튼 텍스트 즉시 업데이트하지 않아도 renderCalendar에서 처리하지만, 
    // 빠른 반응을 위해 여기서 닫기만 처리하고 렌더링 호출
    toggleDropdown('year-dd'); // 닫기
    renderCalendar();
}

// [신규] 월 선택
function selectMonth(monthIdx) {
    calendarDate.setMonth(monthIdx);
    toggleDropdown('month-dd'); // 닫기
    renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    
    // 값 동기화 (버튼 텍스트 업데이트)
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    
    const btnYear = document.getElementById('btn-year');
    const btnMonth = document.getElementById('btn-month');
    
    if(btnYear) btnYear.innerHTML = `${year} <i class="fas fa-caret-down text-sm align-middle opacity-50"></i>`;
    if(btnMonth) btnMonth.innerHTML = `${String(month+1).padStart(2,'0')} <i class="fas fa-caret-down text-sm align-middle opacity-50"></i>`;

    grid.innerHTML = '';
    
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    // 빈 칸 채우기
    for(let i=0; i<firstDay; i++) grid.innerHTML += `<div></div>`;
    
    // 날짜 채우기
    for(let i=1; i<=lastDate; i++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        const dayItems = allData.filter(d => d.date === dateStr);
        const hasData = dayItems.length > 0;
        const isToday = new Date().toISOString().slice(0,10) === dateStr;
        
        const html = `
            <div class="calendar-cell min-h-[60px] md:min-h-[100px] border border-gray-800 bg-[#1a1a1a] rounded p-1 md:p-2 relative hover:bg-gray-800 transition cursor-pointer"
                 onclick="filterByDate('${dateStr}', this)">
                <div class="text-xs md:text-sm font-bold ${isToday ? 'text-red-500' : 'text-gray-400'}">${i}</div>
                ${hasData ? `
                    <div class="mt-1 flex flex-wrap gap-1">
                        ${dayItems.slice(0, 3).map(() => `<div class="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-red-600/80"></div>`).join('')}
                        ${dayItems.length > 3 ? `<span class="text-[8px] text-gray-500">+</span>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
        grid.innerHTML += html;
    }

    // 월별 전체 데이터 하단 노출
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthlyData = allData.filter(item => item.date.startsWith(monthPrefix));
    monthlyData.sort((a, b) => b.date.localeCompare(a.date));
    
    renderCalendarList(monthlyData, `${month + 1}월 전체 아카이브`);
}

function filterByDate(dateStr, element) {
    document.querySelectorAll('.calendar-cell').forEach(cell => {
        cell.classList.remove('border-red-500', 'bg-gray-800');
        cell.classList.add('border-gray-800', 'bg-[#1a1a1a]');
    });
    
    if (element) {
        element.classList.remove('border-gray-800', 'bg-[#1a1a1a]');
        element.classList.add('border-red-500', 'bg-gray-800');
    }

    const dailyData = allData.filter(item => item.date === dateStr);
    renderCalendarList(dailyData, `${dateStr} 아카이브`);
}

function renderCalendarList(dataList, titleText) {
    const listContainer = document.getElementById('calendar-content-list');
    const listTitle = document.getElementById('calendar-list-title');

    listTitle.innerText = titleText;
    listTitle.innerHTML = `<i class="fas fa-calendar-check mr-2"></i> ${titleText} <span class="text-sm text-gray-500 ml-2 font-normal">(${dataList.length}개)</span>`;

    if (dataList.length === 0) {
        listContainer.innerHTML = `
            <div class="col-span-full text-center py-10 text-gray-500">
                <i class="fas fa-box-open text-4xl mb-3 opacity-30"></i>
                <p>해당 날짜에 등록된 컨텐츠가 없습니다.</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = dataList.map(item => `
        <div onclick="handleCardClick('${item.link}')" class="group cursor-pointer bg-[#181818] rounded-md overflow-hidden hover:scale-[1.02] transition duration-300 shadow-md hover:shadow-xl relative border border-gray-800/50">
            <div class="aspect-video bg-gray-900 relative overflow-hidden">
                <img src="${item.thumbnail}" onerror="this.src='${DEFAULT_THUMBNAIL}'" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" loading="lazy">
                <div class="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                     <i class="fas fa-eye text-[9px]"></i> ${item.viewCount.toLocaleString()}
                </div>
            </div>
            <div class="p-3">
                <div class="flex items-center justify-between mb-1.5">
                    <span class="text-[10px] font-bold text-red-500 border border-red-500/50 px-1.5 py-0.5 rounded truncate max-w-[70%]">${item.category}</span>
                    <span class="text-[10px] text-gray-500">${item.date}</span>
                </div>
                <h3 class="text-sm font-bold text-gray-200 line-clamp-2 leading-snug group-hover:text-white transition">${item.title}</h3>
            </div>
        </div>
    `).join('');
}

// ============================================================================
// 🎮 이벤트 리스너
// ============================================================================
function initEventListeners() {
    document.getElementById('search-input').addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        displayCount = 20;
        applyFilters();
    });

    document.getElementById('sort-select').addEventListener('change', (e) => {
        sortOrder = e.target.value;
        applyFilters();
    });

    document.getElementById('load-more-btn').onclick = () => {
        displayCount += 20;
        renderGrid();
    };

    document.querySelectorAll('.main-tab-btn').forEach(btn => {
        btn.onclick = () => switchMainTab(btn.dataset.tab);
    });

    document.getElementById('prev-month-btn').onclick = () => {
        calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar();
    };
    document.getElementById('next-month-btn').onclick = () => {
        calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar();
    };

    const sliderContainer = document.getElementById('top10-list');
    document.getElementById('slide-left').onclick = () => sliderContainer.scrollBy({ left: -300, behavior: 'smooth' });
    document.getElementById('slide-right').onclick = () => sliderContainer.scrollBy({ left: 300, behavior: 'smooth' });
}