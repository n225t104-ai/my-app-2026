document.addEventListener('DOMContentLoaded', () => {
    // 地図の初期化
    const map = L.map('map').setView([35.6812, 139.7671], 5); // 東京駅を中心に表示

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    let spots = JSON.parse(localStorage.getItem('travel_spots') || '[]');
    let currentClickLatLng = null;

    const modal = document.getElementById('modal-overlay');
    const form = document.getElementById('record-form');
    const spotList = document.getElementById('spot-list');
    const cancelBtn = document.getElementById('cancel-btn');
    const fabAdd = document.getElementById('fab-add');
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('map-search');

    // 初期データの描画
    renderSpots();

    // 地図をクリックした時の処理
    map.on('click', (e) => {
        currentClickLatLng = e.latlng;
        modal.classList.remove('hidden');
    });

    // ＋ボタンをクリックした時の処理 (地図の中心にピンを立てる準備)
    fabAdd.addEventListener('click', () => {
        currentClickLatLng = map.getCenter();
        modal.classList.remove('hidden');
    });

    // 検索機能 (Nominatim APIを使用)
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
                
                // 検索結果の場所にすぐ記録できるよう、座標を保持
                currentClickLatLng = { lat: latlng[0], lng: latlng[1] };
                
                // ヒントを表示（オプション）
                searchInput.value = result.display_name;
            } else {
                alert('場所が見つかりませんでした。');
            }
        } catch (error) {
            console.error('Search error:', error);
            alert('検索中にエラーが発生しました。');
        }
    });

    // Enterキーでも検索できるように
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchBtn.click();
        }
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
        // 全マーカー削除 (簡易的な実装)
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });

        spotList.innerHTML = '';

        spots.forEach(spot => {
            // マーカー追加
            const marker = L.marker([spot.lat, spot.lng]).addTo(map);
            const popupContent = `
                <div>
                    <strong>${spot.title}</strong>
                    <p>${spot.description}</p>
                    ${spot.photo ? `<img src="${spot.photo}" style="width:100%">` : ''}
                    <button class="delete-btn" onclick="deleteSpot(${spot.id})">削除</button>
                </div>
            `;
            marker.bindPopup(popupContent);

            // リスト追加
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

    // 画像のリサイズ (LocalStorage対策)
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
                    resolve(canvas.toDataURL('image/jpeg', 0.7)); // 圧縮
                };
            };
        });
    }

    // グローバルに削除関数を公開 (Popup用)
    window.deleteSpot = (id) => {
        if (confirm('この記録を削除しますか？')) {
            spots = spots.filter(s => s.id !== id);
            saveSpots();
            renderSpots();
        }
    };

    // エクスポート機能
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
