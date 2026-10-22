/*
 *  This file contains the events and functions applied to
 *  the document body that is common to all sections or
 *  that doesn't fit into any particular section
 */

import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

import '../scss/main.scss';
import '../scss/course-panel.scss';
import '../scss/timetable.scss';
import '../scss/course-list.scss';

import localforage from 'localforage/dist/localforage';

import './attacher';
import './course-panel';
import './timetable';
import './course-list';
import * as Utils from './utils';
import { firebaseService } from './firebase-service';
import { initSavedTimetablesPage, showSimulatorView, showSavedTimetablesView } from './saved-timetables';

const lastUpdate = require('../../package.json')['lastUpdate'];

$(function () {
    /*
        Initialize Firebase & Saved Timetables
     */
    firebaseService.init();
    initSavedTimetablesPage();

    /*
        Remove focus from quick buttons once clicked
     */
    $('.quick-buttons .btn').on('click', function () {
        $(this).trigger('blur');
    });

    /*
        Set Chennai as default campus
     */
    localforage.getItem('campus').then((campus) => {
        // Default to #Chennai if no prior campus set or first launch
        window.location.hash = campus || '#Chennai';
        switchCampus();

        /*
            Event to listen for hash changes
         */
        $(window).on('hashchange', () => {
            const hash = window.location.hash.toLowerCase();
            if (hash === '#saved' || hash === '#simulator') {
                return;
            }
            if (window.location.hash === `#${window.campus}`) {
                return;
            }

            new bootstrap.Modal($('#switch-campus-modal').get(0)).show();
        });
    });

    Utils.removeTouchHoverCSSRule();

    /*
        Login / Register Modal Handlers
     */
    $('#btn-google-signin').on('click', async function () {
        const $btn = $(this);
        const originalText = $btn.html();
        $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span>Connecting to Google...');
        $('#login-alert').addClass('d-none');

        try {
            await firebaseService.signInWithGoogle();
            const modalEl = document.getElementById('login-modal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        } catch (err) {
            $('#login-alert').removeClass('d-none alert-info alert-success').addClass('alert-danger')
                .text('Google Sign-in: ' + (err.message || 'Error occurred'));
        } finally {
            $btn.prop('disabled', false).html(originalText);
        }
    });

    // Toggle between Sign In and Register tabs
    $('#tab-signin-btn').on('click', function () {
        $(this).addClass('active fw-bold');
        $('#tab-register-btn').removeClass('active fw-bold');
        $('#auth-signin-form').show();
        $('#auth-register-form').hide();
        $('#login-alert').addClass('d-none');
    });

    $('#tab-register-btn').on('click', function () {
        $(this).addClass('active fw-bold');
        $('#tab-signin-btn').removeClass('active fw-bold');
        $('#auth-register-form').show();
        $('#auth-signin-form').hide();
        $('#login-alert').addClass('d-none');
    });

    // Email Sign In submit
    $('#auth-signin-form').on('submit', async function (e) {
        e.preventDefault();
        const email = $('#signin-email').val().trim();
        const password = $('#signin-password').val().trim();
        const $submit = $(this).find('button[type="submit"]');

        $submit.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span> Signing In...');
        $('#login-alert').addClass('d-none');

        try {
            await firebaseService.signInWithEmail(email, password);
            const modal = bootstrap.Modal.getInstance(document.getElementById('login-modal'));
            if (modal) modal.hide();
        } catch (err) {
            $('#login-alert').removeClass('d-none alert-info alert-success').addClass('alert-danger')
                .text('Login Error: ' + err.message);
        } finally {
            $submit.prop('disabled', false).html('Sign In');
        }
    });

    // Email Register submit
    $('#auth-register-form').on('submit', async function (e) {
        e.preventDefault();
        const name = $('#register-name').val().trim();
        const email = $('#register-email').val().trim();
        const password = $('#register-password').val().trim();
        const $submit = $(this).find('button[type="submit"]');

        $submit.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span> Creating Account...');
        $('#login-alert').addClass('d-none');

        try {
            await firebaseService.registerWithEmail(email, password, name);
            const modal = bootstrap.Modal.getInstance(document.getElementById('login-modal'));
            if (modal) modal.hide();
        } catch (err) {
            $('#login-alert').removeClass('d-none alert-info alert-success').addClass('alert-danger')
                .text('Registration Error: ' + err.message);
        } finally {
            $submit.prop('disabled', false).html('Create Account');
        }
    });

    // Student Guest / Demo quick login
    $('#btn-guest-signin').on('click', function () {
        firebaseService.signInGuest("VIT Chennai Student", "student.chennai@vit.ac.in");
        const modal = bootstrap.Modal.getInstance(document.getElementById('login-modal'));
        if (modal) modal.hide();
    });

    // Logout click
    $('.btn-logout-user').on('click', async function (e) {
        e.preventDefault();
        await firebaseService.signOut();
        showSimulatorView(false);
    });

    // Firebase Settings modal config save
    $('#btn-save-firebase-config').on('click', function () {
        const rawJson = $('#custom-firebase-json').val().trim();
        try {
            const parsed = JSON.parse(rawJson);
            firebaseService.saveCustomConfig(parsed);
        } catch (err) {
            alert('Invalid JSON format: ' + err.message);
        }
    });

    // Pre-populate custom firebase config if opened
    $('#firebase-settings-modal').on('show.bs.modal', function () {
        const currentCfg = firebaseService.getConfig();
        $('#custom-firebase-json').val(JSON.stringify(currentCfg, null, 2));
    });
});

/*
    Function to switch campuses - Defaults to Chennai
 */
window.switchCampus = () => {
    if (window.location.hash.toLowerCase() === '#ap') {
        $('#campus').text('AP Campus');
        $('#last-update').text(lastUpdate.ap);
        window.location.hash = '#AP';
        window.campus = 'AP';
    } else if (window.location.hash.toLowerCase() === '#vellore') {
        $('#campus').text('Vellore Campus');
        $('#last-update').text(lastUpdate.vellore);
        window.location.hash = '#Vellore';
        window.campus = 'Vellore';
    } else {
        // Chennai Campus is the default
        $('#campus').text('Chennai Campus');
        $('#last-update').text(lastUpdate.chennai);
        window.location.hash = '#Chennai';
        window.campus = 'Chennai';
    }

    localforage.getItem('campus').then((campus) => {
        localforage.setItem('campus', window.campus).catch(console.error);

        if (campus && campus != window.campus) {
            localforage
                .removeItem('timetableStorage')
                .then(window.location.reload());
            return;
        }

        getCourses();
        initializeTimetable();
    });
};

/*
    Redirect to the GitHub page when Ctrl + U is clicked
    instead of showing the page source code
 */
document.onkeydown = function (e) {
    if (e.ctrlKey && e.key == 'u') {
        window.open('https://github.com/shivansh-ag24/FFCSonTheGo');
        return false;
    } else {
        return true;
    }
};

/*
    Function to clear all sections
 */
window.resetPage = () => {
    clearPanel();
    clearTimetable();
    clearCourseList();
};

/*
    Prompt add to home screen
 */
window.addEventListener('beforeinstallprompt', (e) => {
    ga('send', {
        hitType: 'event',
        eventCategory: 'A2H',
        eventAction: 'Seen',
        eventLabel: `A2H Shown`,
    });

    e.userChoice.then((choiceResult) => {
        ga('send', {
            hitType: 'event',
            eventCategory: 'A2H',
            eventAction: 'click',
            eventLabel: `A2H ${choiceResult.outcome}`,
        });
    });
});
