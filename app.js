document.addEventListener('DOMContentLoaded', () => {
    // 地図の初期化 (日本語ラベルを優先するタイルに変更)
    const map = L.map('map').setView([35.6812, 139.7671], 5);

    // OpenStreetMap Japan (日本語表記を優先)
    L.tileLayer('https://{s}.tile.openstreetmap.jp/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://openstreetmap.jp/">OpenStreetMap Japan</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    let spots = JSON.parse(localStorage.getItem('travel_spots') || '[]');
    let currentClickLatLng = null;
    let spotToDeleteId = null;

    const modal = document.getElementById('modal-overlay');
    const form = document.getElementById('record-form');
    const spotList = document.getElementById('spot-list');
    const cancelBtn = document.getElementById('cancel-btn');
    const fabAdd = document.getElementById('fab-add');
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('map-search');
    const galleryBtn = document.getElementById('gallery-btn');
    const galleryOverlay = document.getElementById('gallery-overlay');
    const closeGallery = document.getElementById('close-gallery');
    const galleryContent = document.getElementById('gallery-content');

    // 削除確認モーダル用
    const confirmOverlay = document.getElementById('confirm-overlay');
    const confirmCancel = document.getElementById('confirm-cancel');
    const confirmDelete = document.getElementById('confirm-delete');

    // 初期データの描画
    renderSpots();

    // ギャラリー表示
    galleryBtn.addEventListener('click', () => {
        renderGallery();
        galleryOverlay.classList.remove('hidden');
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
        modal.classList.remove('hidden');
    });

    // ＋ボタンをクリックした時の処理
    fabAdd.addEventListener('click', () => {
        currentClickLatLng = map.getCenter();
        modal.classList.remove('hidden');
    });

    // 検索機能
    searchBtn.addEventListener('click', async () => {
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
                searchInput.value = result.display_name.split(',')[0]; // 名前を少し短く
            } else {
                alert('場所が見つかりませんでした。');
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchBtn.click();
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
        const description = document.getElementById('description').value;
        const photoFile = document.getElementById('photo').files[0];
        
        let photoBase64 = '';
        if (photoFile) {
            photoBase64 = await resizeImage(photoFile);
        }

        const newSpot = {
            id: Date.now(),
            lat: currentClickLatLng.lat,
            lng: currentClickLatLng.lng,
            title,
            description,
            photo: photoBase64
        };

        spots.push(newSpot);
        saveSpots();
        renderSpots();

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
            if (layer instanceof L.Marker) map.removeLayer(layer);
        });

        spotList.innerHTML = '';

        spots.forEach(spot => {
            const marker = L.marker([spot.lat, spot.lng]).addTo(map);
            const popupContent = `
                <div class="custom-popup">
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
                <h3>${spot.title}</h3>
                <p>${spot.description}</p>
            `;
            li.addEventListener('click', () => {
                map.setView([spot.lat, spot.lng], 13);
                marker.openPopup();
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
});
