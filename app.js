document.addEventListener('DOMContentLoaded', () => {
    // 地図の初期化
    const map = L.map('map', { zoomControl: false }).setView([35.6812, 139.7671], 5);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        minZoom: 2,
        maxZoom: 19
    }).addTo(map);

    // データの読み込み
    let spots = [];
    try {
        const storedSpots = localStorage.getItem('travel_spots');
        spots = storedSpots ? JSON.parse(storedSpots) : [];
        if (!Array.isArray(spots)) spots = [];
    } catch (e) {
        console.error('Failed to load spots:', e);
        spots = [];
    }

    let currentClickLatLng = null;
    let isPreciseLocation = false;
    let spotToDeleteId = null;
    let searchMarker = null;

    // DOM要素
    const modal = document.getElementById('modal-overlay');
    const form = document.getElementById('record-form');
    const spotList = document.getElementById('spot-list');
    const searchInput = document.getElementById('map-search');
    const galleryOverlay = document.getElementById('gallery-overlay');
    const galleryContent = document.getElementById('gallery-content');
    const calendarOverlay = document.getElementById('calendar-overlay');
    const calendarGrid = document.getElementById('calendar-grid');
    const calendarMonthYear = document.getElementById('calendar-month-year');
    const dayDetails = document.getElementById('calendar-day-details');
    const selectedDateLabel = document.getElementById('selected-date-label');
    const daySpotList = document.getElementById('day-spot-list');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const confirmOverlay = document.getElementById('confirm-overlay');
    const errorOverlay = document.getElementById('error-overlay');

    let currentCalendarDate = new Date();

    // ヘルパー関数
    const setListener = (id, event, callback) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, callback);
        return el;
    };

    function openRecordModal() {
        const dateEl = document.getElementById('date');
        if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
        if (modal) modal.classList.remove('hidden');
    }

    // 外部から（ポップアップ等）呼び出せるようにグローバルに公開
    window.openRecordFromPopup = (placeName) => {
        isPreciseLocation = true;
        openRecordModal();
        const titleEl = document.getElementById('title');
        if (titleEl && placeName) {
            titleEl.value = placeName;
        }
        map.closePopup();
    };

    function toggleSidebar() {
        if (sidebar) sidebar.classList.toggle('open');
        if (sidebarOverlay) sidebarOverlay.classList.toggle('visible');
    }

    function renderCalendar() {
        if (!calendarGrid || !calendarMonthYear) return;
        calendarGrid.innerHTML = '';
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        calendarMonthYear.textContent = `${year}年${month + 1}月`;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

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
        if (!selectedDateLabel || !daySpotList || !dayDetails) return;
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
                if (calendarOverlay) calendarOverlay.classList.add('hidden');
                if (spot.lat && spot.lng) {
                    map.setView([spot.lat, spot.lng], 15);
                    map.eachLayer((layer) => {
                        if (layer instanceof L.Marker && layer.getLatLng().lat === spot.lat && layer.getLatLng().lng === spot.lng) {
                            layer.openPopup();
                        }
                    });
                }
            });
            daySpotList.appendChild(li);
        });
    }

    function renderGallery() {
        if (!galleryContent) return;
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
                if (galleryOverlay) galleryOverlay.classList.add('hidden');
                if (spot.lat && spot.lng) {
                    map.setView([spot.lat, spot.lng], 15);
                    map.eachLayer((layer) => {
                        if (layer instanceof L.Marker && layer.getLatLng().lat === spot.lat && layer.getLatLng().lng === spot.lng) {
                            layer.openPopup();
                        }
                    });
                }
            });
            galleryContent.appendChild(div);
        });
    }

    function saveSpots() {
        localStorage.setItem('travel_spots', JSON.stringify(spots));
    }

    function renderSpots() {
        if (!map || !spotList) return;
        
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker && layer !== searchMarker) {
                map.removeLayer(layer);
            }
        });

        spotList.innerHTML = '';
        const sortedSpots = [...spots].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedSpots.forEach(spot => {
            if (!spot.lat || !spot.lng) return;
            const marker = L.marker([spot.lat, spot.lng]).addTo(map);
            
            const container = document.createElement('div');
            container.className = 'custom-popup';
            
            const dateDiv = document.createElement('div');
            dateDiv.style.fontSize = '0.75rem';
            dateDiv.style.color = '#888';
            dateDiv.style.marginBottom = '2px';
            dateDiv.textContent = spot.date.replace(/-/g, '/');
            container.appendChild(dateDiv);
            
            const titleEl = document.createElement('strong');
            titleEl.style.fontSize = '1rem';
            titleEl.textContent = spot.title;
            container.appendChild(titleEl);
            
            const descP = document.createElement('p');
            descP.style.margin = '5px 0';
            descP.style.color = '#666';
            descP.textContent = spot.description;
            container.appendChild(descP);
            
            if (spot.photo) {
                const img = document.createElement('img');
                img.src = spot.photo;
                img.style.width = '100%';
                img.style.borderRadius = '10px';
                img.style.marginTop = '5px';
                container.appendChild(img);
            }
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '削除する';
            
            L.DomEvent.on(deleteBtn, 'click', (e) => {
                L.DomEvent.stopPropagation(e);
                window.openDeleteConfirm(spot.id);
            });
            
            container.appendChild(deleteBtn);
            marker.bindPopup(container);

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
                if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('open')) {
                    toggleSidebar();
                }
            });
            spotList.appendChild(li);
        });
    }

    async function performSearch(query) {
        if (!query) return;
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (data && data.length > 0) {
                const result = data[0];
                const latlng = [parseFloat(result.lat), parseFloat(result.lon)];
                map.setView(latlng, 15);
                currentClickLatLng = { lat: latlng[0], lng: latlng[1] };
                if (searchMarker) map.removeLayer(searchMarker);

                const displayName = result.display_name.split(',')[0];
                const container = document.createElement('div');

                const titleEl = document.createElement('b');
                titleEl.textContent = displayName;
                container.appendChild(titleEl);
                container.appendChild(document.createElement('br'));

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'primary-btn small-btn';
                btn.style.marginTop = '10px';
                btn.style.width = '100%';
                btn.textContent = 'ここを記録する';

                L.DomEvent.on(btn, 'click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    window.openRecordFromPopup(displayName);
                });

                container.appendChild(btn);

                searchMarker = L.marker(latlng).addTo(map)
                    .bindPopup(container)
                    .openPopup();
                return true;
            }
 else {
                if (errorOverlay) errorOverlay.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Search error:', error);
            if (errorOverlay) errorOverlay.classList.remove('hidden');
        }
        return false;
    }

    // イベントリスナー登録
    setListener('calendar-btn', 'click', () => {
        renderCalendar();
        if (calendarOverlay) calendarOverlay.classList.remove('hidden');
        if (window.innerWidth <= 768) toggleSidebar();
    });

    setListener('close-calendar', 'click', () => {
        if (calendarOverlay) calendarOverlay.classList.add('hidden');
    });

    setListener('prev-month', 'click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });

    setListener('next-month', 'click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });

    setListener('gallery-btn', 'click', () => {
        renderGallery();
        if (galleryOverlay) galleryOverlay.classList.remove('hidden');
        if (window.innerWidth <= 768) toggleSidebar();
    });

    setListener('close-gallery', 'click', () => {
        if (galleryOverlay) galleryOverlay.classList.add('hidden');
    });

    setListener('sidebar-toggle', 'click', toggleSidebar);
    setListener('sidebar-overlay', 'click', toggleSidebar);

    setListener('fab-add', 'click', () => {
        currentClickLatLng = map.getCenter();
        isPreciseLocation = false;
        openRecordModal();
    });

    setListener('cancel-btn', 'click', () => {
        if (modal) modal.classList.add('hidden');
        if (form) form.reset();
    });

    setListener('error-close', 'click', () => {
        if (errorOverlay) errorOverlay.classList.add('hidden');
    });

    setListener('confirm-cancel', 'click', () => {
        if (confirmOverlay) confirmOverlay.classList.add('hidden');
        spotToDeleteId = null;
    });

    setListener('confirm-delete', 'click', () => {
        if (spotToDeleteId) {
            spots = spots.filter(s => s.id !== spotToDeleteId);
            saveSpots();
            renderSpots();
            if (confirmOverlay) confirmOverlay.classList.add('hidden');
            spotToDeleteId = null;
        }
    });

    setListener('modal-search-btn', 'click', async () => {
        const titleEl = document.getElementById('title');
        if (titleEl && titleEl.value) {
            const found = await performSearch(titleEl.value);
            if (found) {
                isPreciseLocation = true;
                // 検索結果を見せるために一旦モーダルを閉じる
                if (modal) modal.classList.add('hidden');
            }
        }
    });

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch(searchInput.value);
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = '保存中...';
            }

            try {
                const title = document.getElementById('title').value;
                const date = document.getElementById('date').value;
                const description = document.getElementById('description').value;
                const photoFile = document.getElementById('photo').files[0];

                // 位置情報が確定していない場合は検索を試みる
                if (!isPreciseLocation) {
                    await performSearch(title);
                }

                // それでも位置情報がない場合は現在の地図の中心を使用
                if (!currentClickLatLng) {
                    currentClickLatLng = map.getCenter();
                }

                let photoBase64 = '';
                if (photoFile) {
                    try {
                        photoBase64 = await resizeImage(photoFile);
                    } catch (err) {
                        console.error('Image resize error:', err);
                        // 画像リサイズに失敗しても記録は続ける
                    }
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

                if (searchMarker) {
                    map.removeLayer(searchMarker);
                    searchMarker = null;
                }

                if (modal) modal.classList.add('hidden');
                form.reset();
            } catch (error) {
                console.error('Submit error:', error);
                alert('エラーが発生しました。もう一度お試しください。');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = '記録する';
                }
            }
        });
    }

    setListener('export-btn', 'click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(spots));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "travel_tracker_backup.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    // 地図クリック
    map.on('click', (e) => {
        currentClickLatLng = e.latlng;
        isPreciseLocation = true;
        openRecordModal();
    });

    // 削除確認モーダル
    window.openDeleteConfirm = (id) => {
        spotToDeleteId = id;
        if (confirmOverlay) confirmOverlay.classList.remove('hidden');
        map.closePopup();
    };

    function resizeImage(file) {
        return new Promise((resolve, reject) => {
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
                img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
            };
            reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
        });
    }

    renderSpots();
});
