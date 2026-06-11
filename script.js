// =====================================
// TRANSIT ROUTE OPTIMIZER - PHILIPPINES
// =====================================

// MAP

const map = L.map('map').setView(
    [12.8797, 121.7740],
    6
);

L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        attribution:
            '&copy; OpenStreetMap Contributors'
    }
).addTo(map);

// =====================================
// VARIABLES
// =====================================

let routingControl = null;

let startMarker = null;
let endMarker = null;

let selectedVehicle = "car";
let selectedRoute = "fastest";

let fromLocation = null;
let toLocation = null;

// =====================================
// CUSTOM ICONS
// =====================================

const startIcon = L.icon({
    iconUrl:
        'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    iconSize: [40, 40],
    iconAnchor: [20, 40]
});

const destinationIcon = L.icon({
    iconUrl:
        'https://cdn-icons-png.flaticon.com/512/2776/2776067.png',
    iconSize: [40, 40],
    iconAnchor: [20, 40]
});

// =====================================
// AUTOCOMPLETE
// =====================================

let debounceTimer;

function debounce(callback, delay) {
    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(
        callback,
        delay
    );
}

async function searchPlaces(query) {

    if (query.length < 3) {
        return [];
    }

    try {

        const url =
            `https://nominatim.openstreetmap.org/search?` +
            `format=json&` +
            `limit=5&` +
            `countrycodes=ph&` +
            `q=${encodeURIComponent(query)}`;

        const response =
            await fetch(url);

        return await response.json();

    }
    catch (error) {

        console.error(error);

        return [];
    }
}

function createSuggestions(
    results,
    container,
    input,
    isFrom
) {

    container.innerHTML = '';

    if (results.length === 0) {

        container.style.display = 'none';

        return;
    }

    results.forEach(place => {

        const item =
            document.createElement('div');

        item.className =
            'suggestion-item';

        item.textContent =
            place.display_name;

        item.addEventListener(
            'click',
            () => {

                input.value =
                    place.display_name;

                const selected = {
                    lat:
                        parseFloat(place.lat),
                    lng:
                        parseFloat(place.lon),
                    name:
                        place.display_name
                };

                if (isFrom) {

                    fromLocation =
                        selected;

                }
                else {

                    toLocation =
                        selected;

                }

                container.style.display =
                    'none';
            }
        );

        container.appendChild(item);
    });

    container.style.display =
        'block';
}

// =====================================
// INPUT HANDLERS
// =====================================

const fromInput =
    document.getElementById(
        'fromInput'
    );

const toInput =
    document.getElementById(
        'toInput'
    );

const fromSuggestions =
    document.getElementById(
        'fromSuggestions'
    );

const toSuggestions =
    document.getElementById(
        'toSuggestions'
    );

// FROM

fromInput.addEventListener(
    'input',
    () => {

        debounce(
            async () => {

                const results =
                    await searchPlaces(
                        fromInput.value
                    );

                createSuggestions(
                    results,
                    fromSuggestions,
                    fromInput,
                    true
                );

            },
            500
        );

    }
);

// TO

toInput.addEventListener(
    'input',
    () => {

        debounce(
            async () => {

                const results =
                    await searchPlaces(
                        toInput.value
                    );

                createSuggestions(
                    results,
                    toSuggestions,
                    toInput,
                    false
                );

            },
            500
        );

    }
);

// =====================================
// CLOSE SUGGESTIONS
// =====================================

document.addEventListener(
    'click',
    (e) => {

        if (
            !fromSuggestions.contains(
                e.target
            ) &&
            e.target !== fromInput
        ) {

            fromSuggestions.style.display =
                'none';
        }

        if (
            !toSuggestions.contains(
                e.target
            ) &&
            e.target !== toInput
        ) {

            toSuggestions.style.display =
                'none';
        }

    }
);

// =====================================
// VEHICLE SELECTION
// =====================================

document
    .querySelectorAll(
        '.vehicle-card'
    )
    .forEach(card => {

        card.addEventListener(
            'click',
            () => {

                document
                    .querySelectorAll(
                        '.vehicle-card'
                    )
                    .forEach(c =>
                        c.classList.remove(
                            'active'
                        )
                    );

                card.classList.add(
                    'active'
                );

                selectedVehicle =
                    card.dataset.vehicle;

            }
        );

    });

// =====================================
// ROUTE SELECTION
// =====================================

document
    .querySelectorAll(
        '.route-card'
    )
    .forEach(card => {

        card.addEventListener(
            'click',
            () => {

                document
                    .querySelectorAll(
                        '.route-card'
                    )
                    .forEach(c =>
                        c.classList.remove(
                            'active'
                        )
                    );

                card.classList.add(
                    'active'
                );

                selectedRoute =
                    card.dataset.route;

            }
        );

    });

// =====================================
// ROUTE COLORS
// =====================================

const routeLayers = [];
let currentRoutes = [];

function getRouteColor() {
    if (selectedRoute === 'standard') {
        return '#0984e3';
    }
    return '#00a884';
}

function getProfileForVehicle(vehicle) {
    switch (vehicle) {
        case 'bicycle':
            return 'bike';
        case 'walking':
            return 'foot';
        default:
            return 'driving';
    }
}

function formatDuration(seconds) {
    const totalMinutes = Math.round(seconds / 60);
    if (totalMinutes < 60) {
        return `${totalMinutes} min`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours < 24) {
        return minutes === 0
            ? `${hours}h`
            : `${hours}h ${minutes}m`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    const parts = [`${days}d`];
    if (remainingHours > 0) parts.push(`${remainingHours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    return parts.join(' ');
}

function formatKm(meters) {
    return `${(meters / 1000).toFixed(2)} km`;
}

function clearRouteLayers() {
    routeLayers.forEach(layer => map.removeLayer(layer));
    routeLayers.length = 0;
}

function getVehicleDurationMultiplier(vehicle) {
    switch (vehicle) {
        case 'car':
            return 0.9;
        case 'motorcycle':
            return 1.0;
        case 'bicycle':
            return 3.0;
        case 'walking':
            return 6.5;
        default:
            return 1.0;
    }
}

async function fetchRoutesOSRM(from, to, profile) {
    const origin = `${from.lng},${from.lat}`;
    const destination = `${to.lng},${to.lat}`;
    const url = `https://router.project-osrm.org/route/v1/${profile}/${origin};${destination}?alternatives=true&overview=full&geometries=geojson`; 
    const response = await fetch(url);
    if (!response.ok) throw new Error('Routing service error');
    const data = await response.json();
    return data.routes || [];
}

function drawRoutes(routes) {
    clearRouteLayers();
    if (!routes || routes.length === 0) return;

    const minDuration = Math.min(...routes.map(r => r.duration));
    const maxDistance = Math.max(...routes.map(r => r.distance));

    const bestIdx = selectedRoute === 'fastest'
        ? routes.findIndex(r => r.duration === minDuration)
        : routes.findIndex(r => r.distance === maxDistance);

    routes.forEach((route, index) => {
        const isBest = index === bestIdx;
        const style = {
            color: isBest ? getRouteColor() : '#a5b4fc',
            weight: isBest ? 8 : 5,
            opacity: isBest ? 0.95 : 0.55
        };
        const layer = L.geoJSON(route.geometry, { style }).addTo(map);
        layer.bindPopup(`Route ${index + 1}<br>${formatKm(route.distance)} • ${formatDuration(route.duration * getVehicleDurationMultiplier(selectedVehicle))}`);
        routeLayers.push(layer);
    });

    const group = L.featureGroup(routeLayers);
    map.fitBounds(group.getBounds(), { padding: [60, 60] });
}

function choosePrimaryRoute(routes) {
    if (selectedRoute === 'fastest') {
        return routes.reduce((a, b) => a.duration < b.duration ? a : b);
    }
    return routes.reduce((a, b) => a.distance > b.distance ? a : b);
}

function showAlert(message) {
    alert(message);
}

// =====================================
// FIND ROUTE
// =====================================

document
    .getElementById('findRouteBtn')
    .addEventListener('click',
        async () => {
            if (!fromLocation || !toLocation) {
                showAlert('Please select valid locations from the suggestions.');
                return;
            }

            if (startMarker) map.removeLayer(startMarker);
            if (endMarker) map.removeLayer(endMarker);
            clearRouteLayers();

            startMarker = L.marker([fromLocation.lat, fromLocation.lng], { icon: startIcon })
                .addTo(map)
                .bindPopup('Starting Point');

            endMarker = L.marker([toLocation.lat, toLocation.lng], { icon: destinationIcon })
                .addTo(map)
                .bindPopup('Destination');

            const profile = getProfileForVehicle(selectedVehicle);

            try {
                const routes = await fetchRoutesOSRM(fromLocation, toLocation, profile);
                if (!routes.length) {
                    showAlert('No route found between the selected locations.');
                    return;
                }

                currentRoutes = routes.slice(0, 3);
                drawRoutes(currentRoutes);

                const primary = choosePrimaryRoute(currentRoutes);
                const adjusted = primary.duration * getVehicleDurationMultiplier(selectedVehicle);

                document.getElementById('distanceText').textContent = formatKm(primary.distance);
                document.getElementById('timeText').textContent = formatDuration(adjusted);
            }
            catch (error) {
                console.error(error);
                showAlert('Unable to calculate route. Please try again.');
            }
        }
    );

// =====================================
// RESET
// =====================================

document
    .getElementById(
        'resetBtn'
    )
    .addEventListener(
        'click',
        () => {

            if (routingControl) {

                map.removeControl(
                    routingControl
                );

                routingControl =
                    null;
            }

            if (startMarker) {

                map.removeLayer(
                    startMarker
                );

                startMarker =
                    null;
            }

            if (endMarker) {

                map.removeLayer(
                    endMarker
                );

                endMarker =
                    null;
            }

            fromInput.value = '';
            toInput.value = '';

            fromLocation = null;
            toLocation = null;

            document.getElementById(
                'distanceText'
            ).textContent = '--';

            document.getElementById(
                'timeText'
            ).textContent = '--';

            map.setView(
                [12.8797, 121.7740],
                6
            );

        }
    );