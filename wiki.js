const GAS_URL = 'https://script.google.com/macros/s/AKfycbxH6rYa89icfgv6dw8v1smi7e8Il1epahxXlhBkeMooqUL26SnNYsTBk1qsEaDzHZFm/exec'; 

let rawData = [];
let filteredData = []; 
let displayCount = 20; 
let currentFilters = { contentType: '전체', channel: '전체', category: '전체', search: '', sort: 'latest' };

const DEFAULT_THUMBNAIL = 'https://placehold.co/600x400/1a1a1a/333333?text=%E2%96%B6';

function formatDate(dateVal) {
    if (!dateVal) return "";
    const date = new Date(dateVal);
    if (isNaN(date.getTime())) {
        const match = String(dateVal).match(/^\d{4}-\d{2}-\d{2}/);
        return match ? match[0] : dateVal;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function fetchData() {
    try {
        const response = await fetch(GAS_URL);
        const data = await response.json();
        
        rawData = data.map(item => ({
            title: item['제목'] || '',
            link: item['링크'] || '#',
            thumbnail: item['썸네일 링크'] || `https://i.ytimg.com/vi/${item['링크']?.split('v=')[1]?.split('&')[0]}/hqdefault.jpg`,
            channel: item['업로드 채널'] || '기타', 
            contentType: item['컨텐츠'] || '기타',
            category: item['구분'] || '기타',
            member: item['멤버'] || '전체',
            views: parseInt(item['조회수']) || 0,
            contentDate: formatDate(item['컨텐츠 일자'] || '') 
        })).filter(v => v.title);

        init();
    } catch (err) { showError("데이터 연결 실패"); }
}

function init() {
    document.getElementById('loadingOverlay').classList.add('hidden');
    lucide.createIcons();
    
    const topTen = [...rawData].sort((a, b) => b.views - a.views).slice(0, 10);
    renderRanking(topTen);
    
    generateContentTypeButtons(); 

    document.getElementById('searchInput').addEventListener('input', (e) => {
        currentFilters.search = e.target.value.toLowerCase();
        applyFilters(false, false); 
    });
}

function changeSort() {
    currentFilters.sort = document.getElementById('sortOrder').value;
    applyFilters(false, false);
}

function applyFilters(shouldUpdateChannels, shouldUpdateCategories) {
    displayCount = 20; 
    
    let typeResult = rawData.filter(item => currentFilters.contentType === '전체' || item.contentType === currentFilters.contentType);
    
    if (shouldUpdateChannels) generateChannelButtons(typeResult);
    let channelResult = typeResult.filter(item => currentFilters.channel === '전체' || item.channel === currentFilters.channel);
    
    if (shouldUpdateCategories) generateCategoryButtons(channelResult);
    
    filteredData = channelResult.filter(item => {
        const matchCatBtn = currentFilters.category === '전체' || item.category === currentFilters.category;
        const matchSearch = item.title.toLowerCase().includes(currentFilters.search) || 
                            item.contentDate.includes(currentFilters.search) ||
                            item.category.toLowerCase().includes(currentFilters.search);
        return matchCatBtn && matchSearch;
    });

    if (currentFilters.sort === 'latest') {
        filteredData.sort((a, b) => new Date(b.contentDate) - new Date(a.contentDate));
    } else if (currentFilters.sort === 'oldest') {
        filteredData.sort((a, b) => new Date(a.contentDate) - new Date(b.contentDate));
    } else if (currentFilters.sort === 'views') {
        filteredData.sort((a, b) => b.views - a.views);
    }
    
    document.getElementById('resultCount').innerText = `전체 ${filteredData.length}개`;
    renderGrid();
}

function generateContentTypeButtons() {
    const container = document.getElementById('contentTypeTabs');
    const types = ['전체', ...new Set(rawData.map(item => item.contentType))].sort((a, b) => {
        if (a === '전체') return -1;
        if (b === '전체') return 1;
        return a.localeCompare(b);
    });
    
    container.innerHTML = types.map(val => {
        const isActive = val === currentFilters.contentType;
        return `<button class="pb-3 text-sm md:text-lg font-bold whitespace-nowrap transition ${isActive ? 'tab-active' : 'tab-inactive'}">${val}</button>`;
    }).join('');
    
    container.querySelectorAll('button').forEach(btn => {
        btn.onclick = function() {
            currentFilters.contentType = this.innerText;
            currentFilters.channel = '전체';
            currentFilters.category = '전체';
            generateContentTypeButtons();
            applyFilters(true, true);
        };
    });
    applyFilters(true, true);
}

function generateChannelButtons(filteredByType) {
    const container = document.getElementById('channelTabs');
    const channels = ['전체', ...new Set(filteredByType.map(item => item.channel))].sort((a, b) => {
        if (a === '전체') return -1;
        if (b === '전체') return 1;
        return a.localeCompare(b);
    });
    
    container.innerHTML = channels.map(val => {
        const isActive = val === currentFilters.channel;
        return `<button class="px-4 py-2 rounded-full text-sm font-bold transition whitespace-nowrap flex-shrink-0 ${isActive ? 'bg-[#2a2a2a] text-white border border-gray-500' : 'text-gray-400 hover:text-white hover:bg-[#2a2a2a]'}">${val}</button>`;
    }).join('');
    
    container.querySelectorAll('button').forEach(btn => {
        btn.onclick = function() {
            currentFilters.channel = this.innerText;
            currentFilters.category = '전체'; 
            generateChannelButtons(filteredByType);
            applyFilters(false, true);
        };
    });
}

function generateCategoryButtons(filteredByChannel) {
    const container = document.getElementById('categoryTabs');
    const wrapper = document.getElementById('categoryContainer');
    
    const categories = ['전체', ...new Set(filteredByChannel.map(item => item.category))].sort((a, b) => {
        if (a === '전체') return -1;
        if (b === '전체') return 1;
        return a.localeCompare(b);
    });

    if (categories.length <= 1) {
        wrapper.classList.add('hidden');
        return;
    }
    wrapper.classList.remove('hidden');
    
    container.innerHTML = categories.map(val => {
        const isActive = val === currentFilters.category;
        return `<button class="px-3 py-1 rounded-full text-xs border transition ${isActive ? 'bg-red-600 border-red-600 text-white font-bold' : 'bg-transparent border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'}">${val}</button>`;
    }).join('');
    
    container.querySelectorAll('button').forEach(btn => {
        btn.onclick = function() {
            currentFilters.category = this.innerText;
            generateCategoryButtons(filteredByChannel);
            applyFilters(false, false);
        };
    });
}

// [수정됨] 랭킹 렌더링 (카테고리 삭제)
function renderRanking(videos) {
    const list = document.getElementById('rankingList');
    list.innerHTML = videos.map((v, i) => `
        <div onclick="handleContentClick('${v.link}')" class="flex-shrink-0 group cursor-pointer flex items-end relative pl-4 snap-start">
            <span class="ranking-number absolute bottom-[-10px] left-0 md:left-2 italic font-black">${i + 1}</span>
            <div class="w-36 md:w-52 aspect-[2/3] bg-zinc-800 rounded-lg overflow-hidden shadow-lg relative z-20 ml-6 md:ml-8 transition-transform duration-300 group-hover:scale-105 border border-zinc-800 group-hover:border-gray-500">
                <img src="${v.thumbnail}" onerror="this.src='${DEFAULT_THUMBNAIL}'" class="w-full h-full object-cover" loading="lazy">
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                </div>
        </div>
    `).join('');
}

function renderGrid() {
    const grid = document.getElementById('contentGrid');
    const moreBtn = document.getElementById('loadMoreBtn');
    const itemsToShow = filteredData.slice(0, displayCount);
    
    if (filteredData.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-20 text-gray-500">검색 결과가 없습니다.</div>`;
        moreBtn.classList.add('hidden');
        return;
    }

    grid.innerHTML = itemsToShow.map(v => `
        <div onclick="handleContentClick('${v.link}')" class="group cursor-pointer bg-[#181818] rounded-md overflow-hidden hover:scale-[1.02] transition duration-300 shadow-md hover:shadow-xl hover:z-10 relative">
            <div class="aspect-video bg-gray-900 relative overflow-hidden">
                <img src="${v.thumbnail}" onerror="this.src='${DEFAULT_THUMBNAIL}'" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" loading="lazy">
                <div class="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                     <i class="fas fa-eye text-[9px]"></i> ${v.views.toLocaleString()}
                </div>
            </div>
            <div class="p-3">
                <div class="flex items-center justify-between mb-1.5">
                    <span class="text-[10px] font-bold text-red-500 border border-red-500/50 px-1.5 py-0.5 rounded truncate max-w-[70%]">${v.category}</span>
                    <span class="text-[10px] text-gray-500">${v.contentDate}</span>
                </div>
                <h3 class="text-xs md:text-sm font-bold text-gray-200 line-clamp-2 leading-snug group-hover:text-white transition">${v.title}</h3>
            </div>
        </div>
    `).join('');
    
    if (displayCount < filteredData.length) moreBtn.classList.remove('hidden');
    else moreBtn.classList.add('hidden');
}

function loadMore() { displayCount += 20; renderGrid(); }

function handleContentClick(link) {
    fetch(`${GAS_URL}?action=increment&link=${encodeURIComponent(link)}`, { mode: 'no-cors' });
    window.open(link, '_blank');
}

function showError(msg) {
    document.getElementById('loadingOverlay').classList.add('hidden');
    document.getElementById('errorModal').classList.remove('hidden');
}

window.onload = fetchData;