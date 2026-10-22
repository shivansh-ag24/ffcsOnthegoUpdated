/**
 * Saved Timetables Page & Simulator Form Preview Controller
 * Manages viewing, rendering, and loading cloud-stored timetables in simulator form.
 */

import { firebaseService } from './firebase-service';

export function initSavedTimetablesPage() {
    // Navigation events
    $('#nav-simulator').on('click', function (e) {
        e.preventDefault();
        showSimulatorView();
    });

    $('#nav-saved-timetables').on('click', function (e) {
        e.preventDefault();
        showSavedTimetablesView();
    });

    // Save to Cloud button click in simulator toolbar
    $('#cloud-save-button').on('click', function () {
        handleSaveCurrentTimetable();
    });

    // Save button inside the Save modal
    $('#confirm-cloud-save-btn').on('click', function () {
        executeCloudSave();
    });

    // Refresh saved timetables on auth change
    firebaseService.onAuthStateChanged(async (user) => {
        updateAuthUI(user);
        if (user) {
            refreshSavedBadge();
            if ($('#saved-timetables-page').is(':visible')) {
                renderSavedTimetablesList();
            }
        } else {
            $('#saved-count-badge').hide();
            if ($('#saved-timetables-page').is(':visible')) {
                renderLoggedOutPrompt();
            }
        }
    });

    // Handle hash change for #Saved or #Simulator
    $(window).on('hashchange', () => {
        const hash = window.location.hash.toLowerCase();
        if (hash === '#saved') {
            showSavedTimetablesView(false);
        } else if (hash === '#simulator') {
            showSimulatorView(false);
        }
    });
}

export function showSimulatorView(updateHash = true) {
    $('#saved-timetables-page').hide();
    $('#simulator-page').fadeIn(200);
    $('#nav-simulator').addClass('active fw-bold text-primary');
    $('#nav-saved-timetables').removeClass('active fw-bold text-primary');
    if (updateHash) {
        window.location.hash = `#${window.campus || 'Chennai'}`;
    }
}

export async function showSavedTimetablesView(updateHash = true) {
    $('#simulator-page').hide();
    $('#saved-timetables-page').fadeIn(200);
    $('#nav-simulator').removeClass('active fw-bold text-primary');
    $('#nav-saved-timetables').addClass('active fw-bold text-primary');
    if (updateHash) {
        window.location.hash = '#Saved';
    }

    if (firebaseService.currentUser) {
        await renderSavedTimetablesList();
    } else {
        renderLoggedOutPrompt();
    }
}

export async function refreshSavedBadge() {
    if (!firebaseService.currentUser) {
        $('#saved-count-badge').hide();
        return;
    }
    try {
        const timetables = await firebaseService.getSavedTimetables();
        if (timetables.length > 0) {
            $('#saved-count-badge').text(timetables.length).show();
        } else {
            $('#saved-count-badge').hide();
        }
    } catch (e) {
        console.warn('Could not refresh badge:', e);
    }
}

export function handleSaveCurrentTimetable() {
    if (!firebaseService.currentUser) {
        const loginModal = new bootstrap.Modal(document.getElementById('login-modal'));
        $('#login-alert').removeClass('d-none alert-success').addClass('alert-info')
            .text('Please sign in with Google or Email to save your timetables to Cloud Firestore.');
        loginModal.show();
        return;
    }

    const currentName = (window.activeTable && window.activeTable.name) ? window.activeTable.name : 'Chennai Timetable';
    $('#cloud-save-name-input').val(currentName);
    const saveModal = new bootstrap.Modal(document.getElementById('save-cloud-modal'));
    saveModal.show();
}

async function executeCloudSave() {
    const customName = $('#cloud-save-name-input').val().trim() || 'My Timetable';
    const $btn = $('#confirm-cloud-save-btn');
    const originalText = $btn.html();
    $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span> Saving to Firestore...');

    try {
        const totalCredits = Number($('#total-credits').text()) || 0;
        const currentData = (window.activeTable && window.activeTable.data) ? window.activeTable.data : [];
        const currentQuick = (window.activeTable && window.activeTable.quick) ? window.activeTable.quick : [];

        const record = {
            name: customName,
            campus: window.campus || 'Chennai',
            totalCredits: totalCredits,
            data: currentData,
            quick: currentQuick
        };

        await firebaseService.saveTimetable(record);

        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('save-cloud-modal')).hide();
        showToast('Success!', `Timetable "${customName}" saved to Cloud Firestore!`, 'success');

        refreshSavedBadge();
    } catch (error) {
        console.error('Error saving timetable:', error);
        alert('Could not save timetable: ' + error.message);
    } finally {
        $btn.prop('disabled', false).html(originalText);
    }
}

function renderLoggedOutPrompt() {
    const html = `
        <div class="container my-5 text-center py-5 shadow-sm rounded-4 bg-white border">
            <div class="py-4">
                <i class="fas fa-cloud-lock text-primary mb-3" style="font-size: 3.5rem;"></i>
                <h3 class="fw-bold mb-2">Cloud Timetables Dashboard</h3>
                <p class="text-muted max-w-500 mx-auto mb-4" style="max-width: 500px;">
                    Sign in to save multiple timetables, compare different course combinations, and access your schedules from any device.
                </p>
                <div class="d-flex justify-content-center gap-2">
                    <button class="btn btn-primary px-4 py-2 rounded-pill shadow-sm" data-bs-toggle="modal" data-bs-target="#login-modal">
                        <i class="fas fa-user-circle me-1"></i> Sign In to Access Saved Timetables
                    </button>
                    <button class="btn btn-outline-secondary px-4 py-2 rounded-pill" onclick="window.showSimulatorView()">
                        <i class="fas fa-arrow-left me-1"></i> Back to Simulator
                    </button>
                </div>
            </div>
        </div>
    `;
    $('#saved-timetables-content').html(html);
}

export async function renderSavedTimetablesList() {
    const $container = $('#saved-timetables-content');
    $container.html(`
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted">Loading your cloud timetables from Firestore...</p>
        </div>
    `);

    try {
        const timetables = await firebaseService.getSavedTimetables();

        if (timetables.length === 0) {
            $container.html(`
                <div class="container my-4 text-center py-5 shadow-sm rounded-4 bg-white border">
                    <div class="py-4">
                        <i class="fas fa-calendar-plus text-primary mb-3" style="font-size: 3rem;"></i>
                        <h4 class="fw-bold mb-2">No Saved Timetables Yet</h4>
                        <p class="text-muted mb-4" style="max-width: 480px; margin: 0 auto;">
                            You haven't saved any timetables to Cloud Firestore yet. Build your schedule in the simulator and click <strong>Save to Cloud</strong>.
                        </p>
                        <button class="btn btn-primary px-4 py-2 rounded-pill shadow-sm" onclick="window.showSimulatorView()">
                            <i class="fas fa-calendar-alt me-1"></i> Go to Timetable Simulator
                        </button>
                    </div>
                </div>
            `);
            return;
        }

        let cardsHtml = `
            <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <div>
                    <h3 class="fw-bold mb-1 text-dark">
                        <i class="fas fa-cloud-meatball text-primary me-2"></i>My Saved Timetables
                    </h3>
                    <p class="text-muted mb-0">Manage and preview all your saved schedules in full simulator form.</p>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-success rounded-pill px-3 shadow-sm" onclick="window.handleSaveCurrentTimetable()">
                        <i class="fas fa-plus me-1"></i> Save Current Table
                    </button>
                    <button class="btn btn-outline-primary rounded-pill px-3" onclick="window.showSimulatorView()">
                        <i class="fas fa-calendar-alt me-1"></i> Active Simulator
                    </button>
                </div>
            </div>
            <div class="row g-4" id="saved-cards-row">
        `;

        timetables.forEach((table, idx) => {
            const courseCount = (table.data || []).length;
            const credits = table.totalCredits || 0;
            const campus = table.campus || 'Chennai';
            const dateStr = table.updatedAt ? new Date(table.updatedAt).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : 'Recently saved';

            cardsHtml += `
                <div class="col-12" id="saved-card-${table.id}">
                    <div class="card shadow-sm border rounded-4 overflow-hidden">
                        <div class="card-header bg-light d-flex justify-content-between align-items-center py-3 flex-wrap gap-2">
                            <div>
                                <h5 class="fw-bold mb-1 text-primary">
                                    <i class="fas fa-calendar-check me-2"></i>${escapeHtml(table.name)}
                                </h5>
                                <div class="d-flex gap-2 align-items-center flex-wrap small text-muted">
                                    <span class="badge bg-secondary">${campus} Campus</span>
                                    <span><i class="fas fa-book me-1"></i>${courseCount} courses</span>
                                    <span><i class="fas fa-award me-1"></i>${credits} credits</span>
                                    <span><i class="fas fa-clock me-1"></i>${dateStr}</span>
                                </div>
                            </div>
                            <div class="d-flex gap-2 align-items-center">
                                <button class="btn btn-primary btn-sm rounded-pill px-3 load-in-simulator-btn" data-id="${table.id}">
                                    <i class="fas fa-play me-1"></i> Open in Simulator
                                </button>
                                <button class="btn btn-outline-secondary btn-sm rounded-pill px-3 toggle-grid-btn" data-id="${table.id}">
                                    <i class="fas fa-eye me-1"></i> Toggle Simulator Grid
                                </button>
                                <button class="btn btn-outline-danger btn-sm rounded-circle p-2 delete-saved-table-btn" data-id="${table.id}" title="Delete Timetable">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Full Simulator Grid Form for this Timetable -->
                        <div class="card-body p-3 saved-simulator-preview-container" id="grid-container-${table.id}">
                            <div class="table-responsive text-center">
                                <div class="saved-timetable-grid-slot" data-id="${table.id}"></div>
                            </div>

                            <!-- Course list table for this saved timetable -->
                            <div class="mt-3">
                                <h6 class="fw-bold text-secondary mb-2"><i class="fas fa-list-ul me-1"></i> Enrolled Courses (${courseCount})</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm table-hover align-middle mb-0 small">
                                        <thead class="table-light">
                                            <tr>
                                                <th>Slot</th>
                                                <th>Course Code</th>
                                                <th>Course Title</th>
                                                <th>Faculty</th>
                                                <th>Venue</th>
                                                <th>Credits</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${(table.data || []).map(c => `
                                                <tr>
                                                    <td><span class="badge bg-primary text-white">${escapeHtml(c.slots ? c.slots.join(' + ') : '')}</span></td>
                                                    <td class="fw-bold">${escapeHtml(c.courseCode || '')}</td>
                                                    <td>${escapeHtml(c.courseTitle || '')}</td>
                                                    <td>${escapeHtml(c.faculty || '-')}</td>
                                                    <td>${escapeHtml(c.venue || '-')}</td>
                                                    <td>${escapeHtml(String(c.credits || '0'))}</td>
                                                </tr>
                                            `).join('') || '<tr><td colspan="6" class="text-muted text-center py-2">No courses enrolled in this timetable</td></tr>'}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        cardsHtml += `</div>`;
        $container.html(cardsHtml);

        // Render the exact simulator grids for each card
        timetables.forEach((table) => {
            renderSavedSimulatorGrid(table);
        });

        // Attach action handlers
        $('.load-in-simulator-btn').on('click', function () {
            const id = $(this).data('id');
            const target = timetables.find(t => t.id === id);
            if (target) {
                loadSavedTimetableIntoActive(target);
            }
        });

        $('.toggle-grid-btn').on('click', function () {
            const id = $(this).data('id');
            $(`#grid-container-${id}`).slideToggle(200);
        });

        $('.delete-saved-table-btn').on('click', async function () {
            const id = $(this).data('id');
            const target = timetables.find(t => t.id === id);
            const name = target ? target.name : 'this timetable';
            if (confirm(`Are you sure you want to delete "${name}" from Cloud Firestore?`)) {
                await firebaseService.deleteTimetable(id);
                $(`#saved-card-${id}`).fadeOut(300, function () {
                    $(this).remove();
                    refreshSavedBadge();
                    if ($('#saved-cards-row').children().length === 0) {
                        renderSavedTimetablesList();
                    }
                });
                showToast('Deleted', `Timetable "${name}" removed from cloud storage.`, 'info');
            }
        });

    } catch (e) {
        console.error('Error rendering saved timetables list:', e);
        $container.html(`
            <div class="alert alert-danger my-4">
                <strong>Error loading saved timetables:</strong> ${e.message}
            </div>
        `);
    }
}

/**
 * Builds the exact simulator timetable grid structure for a saved timetable
 */
function renderSavedSimulatorGrid(tableData) {
    const $target = $(`.saved-timetable-grid-slot[data-id="${tableData.id}"]`);
    if (!$target.length) return;

    let schema;
    const campus = (tableData.campus || 'Chennai').toLowerCase();
    try {
        if (campus === 'ap') {
            schema = require('../schemas/ap.json');
        } else if (campus === 'vellore') {
            schema = require('../schemas/vellore.json');
        } else {
            schema = require('../schemas/chennai.json');
        }
    } catch (e) {
        schema = require('../schemas/chennai.json');
    }

    const theory = schema.theory || [];
    const lab = schema.lab || [];
    let theoryIdx = 0, labIdx = 0;

    let tableHtml = `<table class="table table-bordered mb-0 small text-center" style="font-size: 0.82rem;">`;

    // Theory & Lab hours headers
    let theoryRow = `<tr class="bg-light"><td class="fw-bold text-nowrap" style="background:#e8eaf6;">THEORY<br/>HOURS</td>`;
    let labRow = `<tr class="bg-light"><td class="fw-bold text-nowrap" style="background:#e3f2fd;">LAB<br/>HOURS</td>`;

    const dayRows = {
        mon: `<tr id="stt-${tableData.id}-mon"><td class="fw-bold" style="background:#eeeeee;">MON</td>`,
        tue: `<tr id="stt-${tableData.id}-tue"><td class="fw-bold" style="background:#eeeeee;">TUE</td>`,
        wed: `<tr id="stt-${tableData.id}-wed"><td class="fw-bold" style="background:#eeeeee;">WED</td>`,
        thu: `<tr id="stt-${tableData.id}-thu"><td class="fw-bold" style="background:#eeeeee;">THU</td>`,
        fri: `<tr id="stt-${tableData.id}-fri"><td class="fw-bold" style="background:#eeeeee;">FRI</td>`,
        sat: `<tr id="stt-${tableData.id}-sat"><td class="fw-bold" style="background:#eeeeee;">SAT</td>`,
        sun: `<tr id="stt-${tableData.id}-sun"><td class="fw-bold" style="background:#eeeeee;">SUN</td>`
    };

    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    // Map slot to courses in this timetable
    const slotToCourses = {};
    (tableData.data || []).forEach(course => {
        (course.slots || []).forEach(s => {
            if (!slotToCourses[s]) slotToCourses[s] = [];
            slotToCourses[s].push(course);
        });
    });

    while (theoryIdx < theory.length || labIdx < lab.length) {
        const tSlot = theory[theoryIdx];
        const lSlot = lab[labIdx];

        if (tSlot && lSlot && !tSlot.days && !lSlot.days) {
            // Lunch break
            theoryRow += `<td class="fw-bold text-secondary" style="background:#e0e0e0; width:10px;" rowspan="9">L<br/>U<br/>N<br/>C<br/>H</td>`;
            ++theoryIdx;
            ++labIdx;
            continue;
        }

        theoryRow += `<td class="fw-semibold text-nowrap" style="background:#ede7f6;">${tSlot && tSlot.start ? tSlot.start + '<br/>to<br/>' + tSlot.end : '-'}</td>`;
        labRow += `<td class="fw-semibold text-nowrap" style="background:#e1f5fe;">${lSlot && lSlot.start ? lSlot.start + '<br/>to<br/>' + lSlot.end : '-'}</td>`;

        for (const d of days) {
            let label = '';
            let matchedCourses = [];
            let slotCode = '';

            if (tSlot && tSlot.days && tSlot.days[d]) {
                slotCode = tSlot.days[d];
                label = slotCode;
                if (slotToCourses[slotCode]) {
                    matchedCourses.push(...slotToCourses[slotCode]);
                }
            }

            if (lSlot && lSlot.days && lSlot.days[d]) {
                const lCode = lSlot.days[d];
                label = label ? `${label} / ${lCode}` : lCode;
                if (slotToCourses[lCode]) {
                    matchedCourses.push(...slotToCourses[lCode]);
                }
            }

            if (matchedCourses.length > 0) {
                const isClash = matchedCourses.length > 1;
                const bgStyle = isClash 
                    ? 'background-color: #ff5252 !important; color: white !important;' 
                    : 'background-color: #69f0ae !important; color: #1b5e20 !important; font-weight: bold;';
                
                const courseTags = matchedCourses.map(c => `
                    <div style="font-size:0.75rem; padding: 2px 4px; border-radius: 4px; background: rgba(255,255,255,0.85); color: #212121; margin: 2px 0;">
                        <strong>${escapeHtml(c.courseCode)}</strong>${c.venue ? ' (' + escapeHtml(c.venue) + ')' : ''}
                    </div>
                `).join('');

                dayRows[d] += `<td style="${bgStyle} min-width: 85px;">
                    <div class="small fw-bold">${label}</div>
                    ${courseTags}
                </td>`;
            } else {
                dayRows[d] += `<td class="text-muted" style="min-width: 85px; background: #fafafa;">${label || '-'}</td>`;
            }
        }

        if (tSlot && !tSlot.lunch) ++theoryIdx;
        if (lSlot && !lSlot.lunch) ++labIdx;
    }

    theoryRow += `</tr>`;
    labRow += `</tr>`;
    for (const d of days) {
        dayRows[d] += `</tr>`;
    }

    tableHtml += theoryRow + labRow;
    for (const d of days) {
        tableHtml += dayRows[d];
    }
    tableHtml += `</table>`;

    $target.html(tableHtml);
}

/**
 * Loads a saved timetable into the active editor
 */
export function loadSavedTimetableIntoActive(savedTable) {
    if (confirm(`Do you want to open "${savedTable.name}" in the interactive timetable simulator?`)) {
        // Switch view to simulator
        showSimulatorView(false);

        // Switch campus if different
        if (savedTable.campus && savedTable.campus.toLowerCase() !== (window.campus || '').toLowerCase()) {
            window.location.hash = '#' + savedTable.campus;
            window.switchCampus();
        }

        // Add to active timetable storage
        const newId = (window.timetableStorage && window.timetableStorage.length > 0)
            ? window.timetableStorage[window.timetableStorage.length - 1].id + 1
            : 0;

        const newTable = {
            id: newId,
            name: savedTable.name,
            data: JSON.parse(JSON.stringify(savedTable.data || [])),
            quick: JSON.parse(JSON.stringify(savedTable.quick || []))
        };

        if (window.timetableStorage) {
            window.timetableStorage.push(newTable);
            if (window.addTableToPicker) {
                window.addTableToPicker(newId, newTable.name);
            }
            if (window.switchTable) {
                window.switchTable(newId);
            }
        }

        showToast('Timetable Loaded', `"${savedTable.name}" loaded into your active editor.`, 'success');
    }
}

function updateAuthUI(user) {
    if (user) {
        const displayName = user.displayName || user.email.split('@')[0];
        const photo = user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName)}`;

        $('#auth-logged-out').hide();
        $('#auth-logged-in').show();
        $('#auth-user-name').text(displayName);
        $('#auth-user-avatar').attr('src', photo);
    } else {
        $('#auth-logged-in').hide();
        $('#auth-logged-out').show();
    }
}

function showToast(title, message, type = 'info') {
    // Simple bootstrap toast or alert banner
    const alertClass = type === 'success' ? 'alert-success' : (type === 'danger' ? 'alert-danger' : 'alert-info');
    const toastHtml = `
        <div class="alert ${alertClass} alert-dismissible fade show position-fixed bottom-0 end-0 m-3 shadow-lg" role="alert" style="z-index: 9999; max-width: 400px;">
            <strong>${escapeHtml(title)}</strong> ${escapeHtml(message)}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    const $toast = $(toastHtml).appendTo('body');
    setTimeout(() => {
        $toast.alert('close');
    }, 4500);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
}

window.showSimulatorView = showSimulatorView;
window.showSavedTimetablesView = showSavedTimetablesView;
window.handleSaveCurrentTimetable = handleSaveCurrentTimetable;
window.loadSavedTimetableIntoActive = loadSavedTimetableIntoActive;
