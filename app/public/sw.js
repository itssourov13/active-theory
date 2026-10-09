var _assets;
var _needsCache;
var _channel;

function initCache() {
    _needsCache = false;
    caches.open('v1').then(cache => {
        return cache.addAll(_assets);
    });
}

function handleUpload(data) {
    _assets = [];
    data.assets.forEach(path => {
        if (path.includes(data.hostname)) _assets.push(path);
        else _assets.push(new Request(path));
    });

    data.sw.forEach(path => {
        _assets.push(new Request(data.cdn + path));
    });

    if (data.offline) _assets.push('/');

    if (_needsCache) initCache();
}

function clearCache(data) {
    caches.delete('v1');
}

function emit(event, data = {}) {
    data.evt = event;
    _channel.postMessage(data);
}

self.addEventListener('install', function(e) {
    self.skipWaiting();
    if (_assets) e.waitUntil(initCache);
    else _needsCache = true;
});

self.addEventListener('fetch', function(e) {
    if (!e.request.url.includes('/assets/')) return;
    e.respondWith(
        caches.match(e.request).then(response => {
            return response || fetch(e.request);
        })
    );
});

self.addEventListener('message', function(e) {
    _channel = e.ports[0];
    let data = e.data;
    switch (data.fn) {
        case 'upload': handleUpload(data); break;
        case 'clearCache': clearCache(data); break;
    }
});