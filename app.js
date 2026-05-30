// Конфигурация Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDSTBHa9YfcoR11CWIeS5o0yRW5ZZAwsFI",
    authDomain: "tld-mods.firebaseapp.com",
    projectId: "tld-mods",
    storageBucket: "tld-mods.firebasestorage.app",
    messagingSenderId: "370359641604",
    appId: "1:370359641604:web:605e86efc7d0d2ba8e7751"
};

// Инициализация Firebase
const { initializeApp, getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, updateDoc } = window.firebaseModules;
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const modsCollection = collection(db, "mods");

// Clerk
const clerk = new Clerk('pk_test_ZmFpci1mZXJyZXQtMC5jbGVyay5hY2NvdW50cy5kZXYk');

let allMods = [];
let currentCategory = 'all';
let currentSearch = '';
let editingModId = null;

// Загрузка модов из Firestore
async function loadModsFromFirestore() {
    const q = query(modsCollection, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    allMods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderMods();
    updateStats();
}

// Создание мода
async function uploadModToFirestore(modData) {
    await addDoc(modsCollection, modData);
}

// Обновление мода
async function updateModInFirestore(modId, modData) {
    const modRef = doc(db, "mods", modId);
    await updateDoc(modRef, modData);
}

// Удаление мода
async function deleteModFromFirestore(modId) {
    await deleteDoc(doc(db, "mods", modId));
}

// Рендер карточек
function renderMods() {
    const filtered = allMods.filter(m => {
        const matchCat = currentCategory === 'all' || m.category === currentCategory;
        const matchSearch = m.name.toLowerCase().includes(currentSearch.toLowerCase());
        return matchCat && matchSearch;
    });

    const grid = document.getElementById('modsGrid');
    const noMods = document.getElementById('noMods');
    grid.innerHTML = '';

    if (filtered.length === 0) {
        noMods.style.display = 'block';
    } else {
        noMods.style.display = 'none';
        filtered.forEach((mod, idx) => {
            const card = document.createElement('div');
            card.className = 'mod-card';
            card.style.animationDelay = `${idx * 0.05}s`;

            let actionsHtml = `<a href="${mod.download}" target="_blank" class="download-btn">СКАЧАТЬ</a>`;
            if (mod.mirror) {
                actionsHtml += `<a href="${mod.mirror}" target="_blank" class="mirror-btn">ЗЕРКАЛО</a>`;
            }
            if (clerk.user && clerk.user.id === mod.userId) {
                actionsHtml += `<button class="edit-btn" onclick="editMod('${mod.id}')">✏️</button>`;
                actionsHtml += `<button class="delete-btn" onclick="deleteMod('${mod.id}')">🗑️</button>`;
            }

            card.innerHTML = `
                <img src="${mod.image || 'https://placehold.co/600x400/1a1a1a/00ff66?text=TLD+MOD'}" alt="${mod.name}">
                <div class="mod-card-body">
                    <h3>${mod.name}</h3>
                    <p class="desc">${mod.description || 'Без описания'}</p>
                    <div class="meta">
                        <span>👤 ${mod.author || 'Неизвестен'}</span>
                        <span>📦 v${mod.version || '1.0.0'}</span>
                        <span>🏷️ ${categoryLabel(mod.category)}</span>
                    </div>
                    <div class="mod-actions">
                        ${actionsHtml}
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }
}

function categoryLabel(cat) {
    const map = { gameplay: 'Геймплей', graphics: 'Графика', vehicles: 'Транспорт', weapons: 'Оружие', cheats: 'Читы', other: 'Другое' };
    return map[cat] || cat || 'Без категории';
}

function updateStats() {
    document.getElementById('modsCount').textContent = allMods.length;
    const cats = new Set(allMods.map(m => m.category).filter(Boolean));
    document.getElementById('catsCount').textContent = cats.size;
}

function filterMods() {
    currentSearch = document.getElementById('searchInput').value;
    renderMods();
}

// Категории
document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.dataset.category;
        renderMods();
    });
});

// Редактирование мода
function editMod(modId) {
    const mod = allMods.find(m => m.id === modId);
    if (!mod) return;
    document.getElementById('modName').value = mod.name || '';
    document.getElementById('modDesc').value = mod.description || '';
    document.getElementById('modAuthor').value = mod.author || '';
    document.getElementById('modVersion').value = mod.version || '';
    document.getElementById('modDownload').value = mod.download || '';
    document.getElementById('modImage').value = mod.image || '';
    document.getElementById('modMirror').value = mod.mirror || '';
    document.getElementById('modCategory').value = mod.category || '';
    document.getElementById('editModId').value = modId;
    document.getElementById('modalTitle').textContent = '✏️ Редактировать мод';
    document.getElementById('submitModBtn').textContent = 'СОХРАНИТЬ ИЗМЕНЕНИЯ';
    editingModId = modId;
    document.getElementById('uploadModal').style.display = 'flex';
}

// Закрытие модального окна
function closeModal() {
    document.getElementById('uploadModal').style.display = 'none';
    document.getElementById('uploadForm').reset();
    document.getElementById('editModId').value = '';
    document.getElementById('modalTitle').textContent = '📤 Загрузить новый мод';
    document.getElementById('submitModBtn').textContent = 'ЗАГРУЗИТЬ МОД';
    editingModId = null;
}

// Отправка формы (создание или обновление)
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!clerk.user) {
        alert('Войдите, чтобы загружать или редактировать моды');
        return;
    }
    const modData = {
        name: document.getElementById('modName').value,
        description: document.getElementById('modDesc').value,
        author: document.getElementById('modAuthor').value || clerk.user.primaryEmailAddress.emailAddress || 'Аноним',
        version: document.getElementById('modVersion').value || '1.0.0',
        download: document.getElementById('modDownload').value,
        image: document.getElementById('modImage').value,
        mirror: document.getElementById('modMirror').value,
        category: document.getElementById('modCategory').value,
        userId: clerk.user.id,
        createdAt: editingModId ? undefined : new Date().toISOString()
    };

    try {
        if (editingModId) {
            await updateModInFirestore(editingModId, modData);
        } else {
            await uploadModToFirestore({ ...modData, createdAt: new Date().toISOString() });
        }
        closeModal();
        await loadModsFromFirestore();
    } catch (err) {
        alert('Ошибка: ' + err.message);
    }
});

// Удаление мода
async function deleteMod(modId) {
    if (!confirm('Удалить этот мод навсегда?')) return;
    await deleteModFromFirestore(modId);
    await loadModsFromFirestore();
}

// Открытие модального окна для загрузки
document.getElementById('uploadBtn').addEventListener('click', () => {
    closeModal();
    document.getElementById('uploadModal').style.display = 'flex';
});

document.getElementById('signInBtn').addEventListener('click', () => clerk.openSignIn());
document.getElementById('logoutBtn').addEventListener('click', () => clerk.signOut());
window.onclick = (e) => { if (e.target === document.getElementById('uploadModal')) closeModal(); };

// Интерфейс пользователя (без админских кнопок)
function updateUI(user) {
    if (user) {
        document.getElementById('signInBtn').style.display = 'none';
        document.getElementById('userArea').style.display = 'flex';
        document.getElementById('userName').textContent = user.primaryEmailAddress.emailAddress;
    } else {
        document.getElementById('signInBtn').style.display = 'block';
        document.getElementById('userArea').style.display = 'none';
    }
}

clerk.load().then(() => {
    updateUI(clerk.user);
    clerk.addListener(async ({ user }) => {
        updateUI(user);
        await loadModsFromFirestore();
    });
    loadModsFromFirestore();
});
