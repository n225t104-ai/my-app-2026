document.addEventListener('DOMContentLoaded', () => {
    // 地図の初期化 (国土地理院の淡色地図を使用：日本語のみ、海上の線なし)
    const map = L.map('map', { zoomControl: false }).setView([35.6812, 139.7671], 5);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        minZoom: 2,
        maxZoom: 19
    }).addTo(map);

    let spots = JSON.parse(localStorage.getItem('travel_spots') || '[]');
    let currentClickLatLng = null;
    let isPreciseLocation = false; // 地図を直接クリックしたかどうか
    let spotToDeleteId = null;
    let searchMarker = null;

    const modal = document.getElementById('modal-overlay');
    const form = document.getElementById('record-form');
    const spotList = document.getElementById('spot-list');
    const cancelBtn = document.getElementById('cancel-btn');
    const fabAdd = document.getElementById('fab-add');
    const searchInput = document.getElementById('map-search');
    const modalSearchBtn = document.getElementById('modal-search-btn');
    const galleryBtn = document.getElementById('gallery-btn');
    const galleryOverlay = document.getElementById('gallery-overlay');
    const closeGallery = document.getElementById('close-gallery');
    const galleryContent = document.getElementById('gallery-content');

    // カレンダー用
    const calendarBtn = document.getElementById('calendar-btn');
    const calendarOverlay = document.getElementById('calendar-overlay');
    const closeCalendar = document.getElementById('close-calendar');
    const calendarGrid = document.getElementById('calendar-grid');
    const calendarMonthYear = document.getElementById('calendar-month-year');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    const dayDetails = document.getElementById('calendar-day-details');
    const selectedDateLabel = document.getElementById('selected-date-label');
    const daySpotList = document.getElementById('day-spot-list');

    let currentCalendarDate = new Date();

    calendarBtn.addEventListener('click', () => {
        renderCalendar();
        calendarOverlay.classList.remove('hidden');
        if (window.innerWidth <= 768) toggleSidebar();
    });

    closeCalendar.addEventListener('click', () => {
        calendarOverlay.classList.add('hidden');
    });

    prevMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });

    function renderCalendar() {
        calendarGrid.innerHTML = '';
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        calendarMonthYear.textContent = `${year}年${month + 1}月`;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // 空白の追加
        for (let i = 0; i < firstDay; i++) {
            const div = document.createElement('div');
            div.className = 'calendar-day empty';
            calendarGrid.appendChild(div);
        }

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const div = document.createElement('div');
            div.className = 'calendar-day';
            div.textContent = day;

            if (dateStr === todayStr) div.classList.add('today');

            const spotsOnDay = spots.filter(s => s.date === dateStr);
            if (spotsOnDay.length > 0) div.classList.add('has-spot');

            div.addEventListener('click', () => {
                document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
                div.classList.add('selected');
                showDayDetails(dateStr, spotsOnDay);
            });

            calendarGrid.appendChild(div);
        }
    }

    function showDayDetails(dateStr, daySpots) {
        selectedDateLabel.textContent = dateStr.replace(/-/g, '/');
        daySpotList.innerHTML = '';
        dayDetails.classList.remove('hidden');

        if (daySpots.length === 0) {
            daySpotList.innerHTML = '<li>この日の記録はありません</li>';
            return;
        }

        daySpots.forEach(spot => {
            const li = document.createElement('li');
            li.className = 'day-spot-item';
            li.textContent = spot.title;
            li.addEventListener('click', () => {
                calendarOverlay.classList.add('hidden');
                map.setView([spot.lat, spot.lng], 15);
                map.eachLayer((layer) => {
                    if (layer instanceof L.Marker && layer.getLatLng().lat === spot.lat && layer.getLatLng().lng === spot.lng) {
                        layer.openPopup();
                    }
                });
            });
            daySpotList.appendChild(li);
        });
    }

    // モバイル用サイドバー操作
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    function toggleSidebar() {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('visible');
    }

    sidebarToggle.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', toggleSidebar);

    // 削除確認モーダル用
    const confirmOverlay = document.getElementById('confirm-overlay');
    const confirmCancel = document.getElementById('confirm-cancel');
    const confirmDelete = document.getElementById('confirm-delete');

    // 検索エラーモーダル用
    const errorOverlay = document.getElementById('error-overlay');
    const errorClose = document.getElementById('error-close');

    errorClose.addEventListener('click', () => {
        errorOverlay.classList.add('hidden');
    });

    // ギャラリー表示
    galleryBtn.addEventListener('click', () => {
        renderGallery();
        galleryOverlay.classList.remove('hidden');
        if (window.innerWidth <= 768) toggleSidebar();
    });

    closeGallery.addEventListener('click', () => {
        galleryOverlay.classList.add('hidden');
    });

    function renderGallery() {
        galleryContent.innerHTML = '';
        const spotsWithPhotos = spots.filter(s => s.photo);

        if (spotsWithPhotos.length === 0) {
            galleryContent.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">写真がありません。地図に思い出を追加してください。</p>';
            return;
        }

        spotsWithPhotos.forEach(spot => {
            const div = document.createElement('div');
            div.className = 'gallery-item';
            div.innerHTML = `
                <img src="${spot.photo}" alt="${spot.title}">
                <div class="overlay">${spot.title}</div>
            `;
            div.addEventListener('click', () => {
                galleryOverlay.classList.add('hidden');
                map.setView([spot.lat, spot.lng], 15);
                map.eachLayer((layer) => {
                    if (layer instanceof L.Marker && layer.getLatLng().lat === spot.lat && layer.getLatLng().lng === spot.lng) {
                        layer.openPopup();
                    }
                });
            });
            galleryContent.appendChild(div);
        });
    }

    // 地図をクリックした時の処理
    map.on('click', (e) => {
        currentClickLatLng = e.latlng;
        isPreciseLocation = true;
        document.getElementById('date').value = new Date().toISOString().split('T')[0];
        modal.classList.remove('hidden');
    });

    // ＋ボタンをクリックした時の処理
    fabAdd.addEventListener('click', () => {
        currentClickLatLng = map.getCenter();
        isPreciseLocation = false;
        document.getElementById('date').value = new Date().toISOString().split('T')[0];
        modal.classList.remove('hidden');
    });

    // モーダル内の検索ボタン
    modalSearchBtn.addEventListener('click', async () => {
        const title = document.getElementById('title').value;
        if (!title) return;

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(title)}`);
            const data = await response.json();
            if (data && data.length > 0) {
                const result = data[0];
                currentClickLatLng = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
                isPreciseLocation = true; // 検索で見つかった場所を確定とする
                map.setView([currentClickLatLng.lat, currentClickLatLng.lng], 15);
                
                // 地図上に一時的なピンを表示
                if (searchMarker) map.removeLayer(searchMarker);
                searchMarker = L.marker([currentClickLatLng.lat, currentClickLatLng.lng]).addTo(map)
                    .bindPopup(`<b>${title}</b><br>この場所に保存します`)
                    .openPopup();
            } else {
                errorOverlay.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Modal search error:', error);
            errorOverlay.classList.remove('hidden');
        }
    });

    // 検索機能
    async function performSearch() {
        const query = searchInput.value;
        if (!query) return;

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data && data.length > 0) {
                const result = data[0];
                const latlng = [parseFloat(result.lat), parseFloat(result.lon)];
                map.setView(latlng, 15);
                currentClickLatLng = { lat: latlng[0], lng: latlng[1] };
                searchInput.value = result.display_name.split(',')[0];

                // 検索結果にピンを立てる
                if (searchMarker) map.removeLayer(searchMarker);
                searchMarker = L.marker(latlng).addTo(map)
                    .bindPopup(`<b>${searchInput.value}</b><br>ここを記録しますか？`)
                    .openPopup();

                if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
                    toggleSidebar();
                }
            } else {
                errorOverlay.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Search error:', error);
            errorOverlay.classList.remove('hidden');
        }
    }

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    // キャンセルボタン
    cancelBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        form.reset();
    });

    // フォーム送信
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('title').value;
        const date = document.getElementById('date').value;
        const description = document.getElementById('description').value;
        const photoFile = document.getElementById('photo').files[0];
        
        // ＋ボタンから（直接クリック以外）で記録しようとした場合、タイトルで再検索を試みる
        if (!isPreciseLocation) {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(title)}`);
                const data = await response.json();
                if (data && data.length > 0) {
                    currentClickLatLng = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
                    map.setView([currentClickLatLng.lat, currentClickLatLng.lng], 15);
                }
            } catch (err) {
                console.error('Submit geocoding error:', err);
            }
        }

        let photoBase64 = '';
        if (photoFile) {
            photoBase64 = await resizeImage(photoFile);
        }

        const newSpot = {
            id: Date.now(),
            lat: currentClickLatLng.lat,
            lng: currentClickLatLng.lng,
            title,
            date,
            description,
            photo: photoBase64
        };

        spots.push(newSpot);
        saveSpots();
        renderSpots();

        // 検索ピンがあれば消す
        if (searchMarker) {
            map.removeLayer(searchMarker);
            searchMarker = null;
        }

        modal.classList.add('hidden');
        form.reset();
    });

    // データの保存
    function saveSpots() {
        localStorage.setItem('travel_spots', JSON.stringify(spots));
    }

    // データの描画
    function renderSpots() {
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                const popup = layer.getPopup();
                if (popup) {
                    const content = popup.getContent();
                    // 文字列またはHTML要素の中身をチェック
                    const contentStr = (typeof content === 'string') ? content : (content instanceof HTMLElement ? content.innerHTML : '');
                    if (!contentStr.includes('ここを記録しますか？')) {
                        map.removeLayer(layer);
                    }
                } else {
                    map.removeLayer(layer);
                }
            }
        });

        spotList.innerHTML = '';

        // 日付順にソートして表示
        const sortedSpots = [...spots].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedSpots.forEach(spot => {
            const marker = L.marker([spot.lat, spot.lng]).addTo(map);
            const popupContent = `
                <div class="custom-popup">
                    <div style="font-size: 0.75rem; color: #888; margin-bottom: 2px;">${spot.date.replace(/-/g, '/')}</div>
                    <strong style="font-size: 1rem;">${spot.title}</strong>
                    <p style="margin: 5px 0; color: #666;">${spot.description}</p>
                    ${spot.photo ? `<img src="${spot.photo}" style="width:100%; border-radius: 10px; margin-top: 5px;">` : ''}
                    <button class="delete-btn" onclick="openDeleteConfirm(${spot.id})">削除する</button>
                </div>
            `;
            marker.bindPopup(popupContent);

            const li = document.createElement('li');
            li.className = 'spot-item';
            li.innerHTML = `
                <div style="font-size: 0.7rem; color: #aaa;">${spot.date.replace(/-/g, '/')}</div>
                <h3>${spot.title}</h3>
                <p>${spot.description}</p>
            `;
            li.addEventListener('click', () => {
                map.setView([spot.lat, spot.lng], 13);
                marker.openPopup();
                if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
                    toggleSidebar();
                }
            });
            spotList.appendChild(li);
        });
    }

    // カスタム削除モーダルを開く
    window.openDeleteConfirm = (id) => {
        spotToDeleteId = id;
        confirmOverlay.classList.remove('hidden');
        map.closePopup();
    };

    confirmCancel.addEventListener('click', () => {
        confirmOverlay.classList.add('hidden');
        spotToDeleteId = null;
    });

    confirmDelete.addEventListener('click', () => {
        if (spotToDeleteId) {
            spots = spots.filter(s => s.id !== spotToDeleteId);
            saveSpots();
            renderSpots();
            confirmOverlay.classList.add('hidden');
            spotToDeleteId = null;
        }
    });

    function resizeImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    let width = img.width;
                    let height = img.height;
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
            };
        });
    }

    document.getElementById('export-btn').addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(spots));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "travel_tracker_backup.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    // 初期データの描画 (最後に実行)
    renderSpots();
});
