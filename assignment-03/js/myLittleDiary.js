var myLittleDiary = (function () {
    'use strict';
    var cfg = {
        debug: false,

        ids: {
            feedbacks:     'feedbacks',
            devActions:    'dev-actions',
            formPostEntry: 'post-entry',
            formTitle:     'title',
            formDesc:      'description',
            formLocation:  'location',
            map:           'map'
        },

        entryIDSuf: 'entry-',

        classes: {
            canCollapse:      'can-collapse',
            canClick:         'can-click',
            collapseTrigger:  'collapse-trigger',
            collapseToggled:  'collapse-target',
            state:            'open',
            entry:            'entry',
            entriesContainer: 'entries',
            feedbacks:        'feedbacks',
            feedback:         'feedback-entry',
            mainToggler:      'toggle-all',
            closeAll:         'close-all',
            action:           'action',
            mapOK:            'has-content'
        },

        templates:  {
            entry: {
                id: 'tpl-entry'
            },
            editEntry: {
                id: 'tpl-edit-entry'
            },
            feedbackEntry: {
                id: 'tpl-feedback-entry'
            }
        },

        map:         null,
        hasLocation: false,
        geoOptions:  {
            enableHighAccuracy: true,
            maximumAge : 30000,
            timeout : 27000
        },
        markers: {},
        boundaries: [],

        dependencies: [
            'jsviews',
            'jQuery',
            'localStorage'
        ],

        defaultEntry: function () {
            return {
                'entryID':     null,
                'time':        new Date().getTime(),
                'title':       null,
                'description': null,
                'location':    false
            };
        }
    };

    /**
     * Check that dependies are met.
     * @param  {array}   dependencies Methods needed for this application to run
     * @return {boolean}              Can we launch the app?
     */
    function testDependencies() {
        var i = 0, error, depLength = cfg.dependencies.length;

        for (; i < depLength; i++) {
            if (undefined === window[cfg.dependencies[i]]) {
                error = 'This application needs ' + cfg.dependencies[i] + ' (which cannot be found).';
                notifyUser(error, 'error');
                return false;
            }
        }

        return true;
    }

    /**
     * Launch basic setup for the application.
     */
    function init() {
        cfg.counter = localStorage.getItem('counter') ? parseInt(localStorage.getItem('counter'), 10) : 0;
        cfg.select  = createSelectors();

        // Collapse all contents.
        // Show the user they can click on titles.
        // Set default heights.
        // Toggle classes and compute heights on click.
        $(document).ready(function () {
            var $containers = $(cfg.select.classes.canCollapse);

            // Register templates.
            $.each(cfg.templates, function (tpl) {
                jsviews.templates(cfg.templates[tpl].id, $('#' + cfg.templates[tpl].id).html());
            });

            // Add the feedback box;
            $('body').prepend(
                $('<div/>', {
                    id:    cfg.ids.feedbacks,
                    class: cfg.classes.feedbacks
                })
            );

            // Collapse collapsable items.
            $containers.each(function () {
                showClickable($(this));
                setHeight($(this));
            });

            // Reset heights when the window is resized or the orientation changes.
            $(window).on('resize', function () {
                $containers.each(function () {
                    setHeight($(this));
                });
            });

            // Handle collapsable items.
            $(cfg.select.classes.entriesContainer).on('click', cfg.select.classes.collapseTrigger, function () {
                var $collapsable = $(this).closest(cfg.select.classes.canCollapse);
                $collapsable.toggleClass(cfg.classes.state);
                setHeight($collapsable);

                if ($collapsable.hasClass(cfg.classes.entry)) {
                    panToMarker(getEntry($collapsable.attr('id').replace(cfg.entryIDSuf, '')));
                }
            });

            // Collapse all!
            $(cfg.select.classes.mainToggler)
                .addClass(cfg.classes.canClick)
                .on('click', function () {
                    $(cfg.select.classes.canCollapse)
                        .removeClass(cfg.classes.state)
                        .each(function () {
                            setHeight($(this));
                        });
                });

            // Handle actions on entries.
            $(cfg.select.classes.entriesContainer).on('click', cfg.select.classes.action, function (event) {
                event.preventDefault();

                handleActions(this);
            });

            // Handle feedbacks and related actions.
            $(cfg.select.ids.feedbacks).on('click', cfg.select.classes.canClick, function () {
                myLittleDiary[$(this).data('action')]($(this));
            });

            // Handle dev tools and related actions.
            if (cfg.debug) {
                $('html').addClass('debug');
                $(cfg.select.ids.devActions).on('click', cfg.select.classes.action, function () {
                    myLittleDiary[$(this).data('action')]();
                });
            }

            // Test status for notifications.
            requestNotificationPermission();

            // Display entries in localStorage.
            displayLocalEntries();

            // Draw map with markers.
            placeMarkers(drawMap(cfg.select.classes.entriesContainer));
        });

        /**
         * Check if some entries were added dynamicaly
         * @param {object} data jQuery objects to operate on.
         */
        $(cfg.select.classes.entriesContainer).on('entryAdded', function (event, data) {
            showClickable(data.objects);
            setHeight(data.objects);
        });

        $(cfg.select.ids.formPostEntry).on('submit click', function (event) {
            event.preventDefault();
            postEntry();
        });
    }

    /**
     * Create selectors based on classes and ids defined in cfg.
     */
    function createSelectors() {
        var selectors = {ids: {}, classes: {} };

        $.each(cfg.ids, function (key, value) {
            selectors.ids[key] = '#' + value;
        });
        $.each(cfg.classes, function (key, value) {
            selectors.classes[key] = '.' + value;
        });

        return selectors;
    }

// *************************************************************************************************
// entries
// *************************************************************************************************

    /**
     * Returns all valid entries in the local storage.
     * @return {Array} Array of valid entries.
     */
    function getEntries() {
        var i = 0, entries = [], entry, v;

        if (0 === cfg.counter) {
            return entries;
        }

        // Apparently, entries are still present in the localStorage somehow, so looping with .length
        // will return as much  missing entries as there was removed items.
        for (; i <= cfg.counter; i++) {
            v = localStorage.getItem(i);

            if (undefined !== v && v) {
                entry = JSON.parse(v);
            }

            if (entry && entry.entryID && i === entry.entryID) {
                entries.push(entry);
            }
        }

        return entries;
    }

    /**
     * Get any entry.
     * This function assumes the key in the local storage is the same as the entry, which could
     *     probably lead to troubles. On the other hand, checking entry ID from within the value of
     *     the key is probably way slower (asumption not verified).
     * @param  {Integer} key Any valid key defining an object in the local storage.
     * @return {Object}      Item and its properties:values.
     */
    function getEntry(key) {
        var item = JSON.parse(localStorage.getItem(key));

        if (!item) {
            throw('No item found!');
        }

        return item;
    }

    /**
     * Display entries stored in the local storage.
     */
    function displayLocalEntries() {
        var entries = getEntries();

        if(0 !== entries.length) {
            addEntryToDOM(getEntries());
        }
    }

    /**
     * Create a new entry based on the form.
     * Show it on the document.
     * Store it into DB.
     * Notify user!
     */
    function postEntry() {
        var entry       = cfg.defaultEntry(),
            useLocation = $(cfg.select.ids.formLocation).prop('checked');

        entry.entryID     = cfg.counter + 1;
        entry.title       = $(cfg.select.ids.formTitle).val();
        entry.description = $(cfg.select.ids.formDesc).val();

        if (!entry.title || !entry.description) {
            return;
        }

        addEntryToDOM([entry]);
        updateEntryInDB(entry);
        addMarker(entry);
        notifyUser('Your entry was posted successfully!');

        if (true === useLocation) {
            updateLocation(entry.entryID);
        }
    }

    /**
     * Add entry in the list of existing queries.
     * @param {Array} data Contains the structure of entries to fill in the template.
     */
    function addEntryToDOM(entries) {
        var output    = [],
            objectsId = [];

        // Create new objects and their references based on entries and templates.
        try {
            $.isArray(entries);
            $.each(entries, function (i, entry) {
                output.push(templatize(cfg.templates.entry.id, entry));
                objectsId.push('#' + cfg.entryIDSuf + entry.entryID);
            });
        } catch (e) {
            throw(e);
        }

        // Add all objects to DOM, and let event listener know we added specific entries.
        $(cfg.select.classes.entriesContainer)
            .prepend(output.reverse())
            .trigger('entryAdded', [{
                objects: $(objectsId.join(', '))
            }]);
    }

    /**
     * Store entry in the local storage and increment the counter.
     * @param {Object} data JSON string describing the object to store.
     *
     * @param {Integer}     Optional entry ID
     */
    function updateEntryInDB(data) {
        var type    = 'add',
            entryID = cfg.counter + 1;

        if (1 < arguments.length) {
            type    = 'update';
            entryID = arguments[1];
        }

        try {
            localStorage.setItem(entryID, JSON.stringify(data));

            if ('add' === type) {
                localStorage.setItem('counter', ++cfg.counter);
            }
        } catch (e) {
            notifyUser('Sorry, there was a problem while submitting your entry, ' +
                       'please check console log.',
                       'warning');
        }
    }

    /**
     * Edit the content of an entry.
     * @param {Integer} entryID ID of the entry to edit
     */
    function editEntry(entryID) {
        var entry     = cfg.defaultEntry(),
            $entryDOM = $('#' + cfg.entryIDSuf + entryID),
            useNewLoc = $(cfg.select.ids.formLocation + '-' + entryID).prop('checked');

        entry.entryID     = parseInt(entryID, 10);
        entry.title       = $(cfg.select.ids.formTitle + '-' + entryID).val();
        entry.description = $(cfg.select.ids.formDesc + '-' + entryID).val();
        entry.location    = getEntry(entryID).location;

        if (!entry.title || !entry.description) {
            return;
        }
        
        var $output = $(templatize(
                cfg.templates.entry.id,
                entry
            )
        );

        if (true === useNewLoc) {
            updateLocation(entryID);
        }

        updateEntryInDB(entry, entryID);
        updateMarker(entry);
        panToMarker(entry);
        $entryDOM.replaceWith($output);
        notifyUser('Your entry was updated successfully!');

        return $output;
    }

    /**
     * Remove an entry from the document.
     * Remove it into DB.
     * Notify user!
     * @param {Integer} entryID ID of the entry to remove
     */
    function removeEntry(entryID) {
        var title = JSON.parse(localStorage.getItem(entryID)).title;

        removeEntryFromDOM(entryID);
        removeMarker(getEntry(entryID));
        removeEntryFromDB(entryID);

        notifyUser('The post “' + title + '” was removed successfully!');
    }

    /**
     * Remove and entry from the DOM or notify the user if a problem occured.
     * @param {Integer} entryID ID of the entry to remove
     */
    function removeEntryFromDOM(entryID) {
        try {
            $('#' + cfg.entryIDSuf + entryID).remove();
        } catch (exception) {
            notifyUser('Sorry, the entry could not be removed from the DOM.',
                       'error');
            throw(exception.message);
        }
    }

    /**
     * Remove an entry from the local storage or notify the user if a problem occured.
     * @param {Integer} entryID ID of the entry to remove
     */
    function removeEntryFromDB(entryID) {


        try {
            localStorage.removeItem(entryID);
        } catch (exception) {
            notifyUser('Sorry, the entry could not be removed from the DB.',
                       'error');
            throw(exception.message);
        }
    }

// *************************************************************************************************
// geolocation
// *************************************************************************************************

    /**
     * Get location based on environment and user interaction.
     * @return {Promise} A deferred object to be used by the caller.
     */
    function getLocation() {
        var checking = new $.Deferred();

        function getLocationSuccess(position) {
            var latitude  = position.coords.latitude,
                longitude = position.coords.longitude,
                altitude  = position.coords.altitude,
                accuracy  = position.coords.accuracy,
                location  = {
                    latitude: latitude,
                    longitude: longitude,
                    altitude: altitude,
                    accuracy: accuracy
                };

            checking.resolve({
                msg: 'Got your location!',
                location: location
            });
        }

        function getLocationError(error) {
            var errorMsg;

            switch (error.code) {
                case 1:
                    errorMsg = 'As defined in your settings, your location won’t be shared.';
                    break;
                case 2:
                    errorMsg = 'Your location is not available at the moment.';
                    break;
                case 3:
                    errorMsg = 'We could not get your location because the operation timed out. ' +
                               'You might try to edit your post later.';
                    break;
            }

            checking.reject({
                msg: errorMsg,
                location: false
            });
        }

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(getLocationSuccess, getLocationError, cfg.geoOptions);
        }

        return checking.notify('Waiting for user and browser to take action.');
    }

    /**
     * Update the location after an entry has been posted or updated.
     * @param  {Integer} entryID ID of an entry
     */
    function updateLocation(entryID) {
        var entry     = JSON.parse(localStorage.getItem(entryID));

        return getLocation()
            .progress(function (answer) {
                giveFeedback(answer, 'info');
            })
            .done(function (answer) {
                entry.location = answer.location;
                updateEntryInDB(entry, entryID);

                updateMarker(entry);

                giveFeedback('The location for “' + entry.title + '” has been updated.', 'info');
            })
            .fail(function (answer) {
                giveFeedback('Your location was not updated for the following reason: ' + answer.msg);
            });
    }

// *************************************************************************************************
// map
// *************************************************************************************************

    /**
     * Draw a map.
     * @return {map} Leaflet map object
     */
    function drawMap() {
        // Test availability for leaflet and stop here if it is not available.
        // Let CSS know it can style the map if leaflet is here.
        try {
            if(L.version) {
                $(cfg.select.ids.map).addClass(cfg.classes.mapOK);
            }
        } catch (e) {
            throw(e.message);
        }

        cfg.map = L.map('map').setView([0, 0], 13);

        L.tileLayer('https://{s}.tiles.mapbox.com/v3/{id}/{z}/{x}/{y}.png', {
            maxZoom: 15,
            attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
                '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
                'Imagery © <a href="http://mapbox.com">Mapbox</a>',
            id: 'examples.map-i875mjb7'
        }).addTo(cfg.map);

        return cfg.map;
    }

    /**
     * Place markers on the map for each existing entry.
     * Fit the map so that all markers are visible.
     * @param  {Map} map Leaflet Map object.
     */
    function placeMarkers() {
        if (undefined === cfg.map) {
            throw('"map" is not defined.');
        }

        $.each(getEntries(), function (i, entry) {
            if (entry.location) {
                addMarker(entry);
            }
        });
    }

    /**
     * Add a marker for a newly created entry.
     * @param {JSON} entry Structure of an object
     */
    function addMarker(entry) {
        if (entry.location) {
            var marker = cfg.markers[entry.entryID] = {},
                latLng = [entry.location.latitude, entry.location.longitude];

            marker.layer = L.marker(latLng).addTo(cfg.map);
            marker.popup = L.popup().setContent('<b>' + entry.title + '</b>');

            marker.layer.bindPopup(marker.popup);

            cfg.boundaries.push(latLng);
            fitBoundaries();
            marker.layer.openPopup();
        }
    }

    /**
     * Update a marker to match new geolocation.
     * @param {JSON} entry Structure of an object
     */
    function updateMarker(entry) {
        var marker = cfg.markers[entry.entryID];

        if (marker) {
            var latLng = [entry.location.latitude, entry.location.longitude];
            marker.layer.setLatLng(latLng);

            marker.popup.setContent('<b>' + entry.title + '</b>');
            marker.layer.openPopup();

            cfg.boundaries.splice(findInBoundaries(entry), 1, latLng);
            fitBoundaries();
        } else {
            addMarker(entry);
        }
    }

    /**
     * Remove a marker from the map.
     * @param {JSON} entry Structure of an object
     */
    function removeMarker(entry) {
        if (cfg.markers[entry.entryID]) {
            var prevBound = findInBoundaries(entry);
            cfg.boundaries.splice(prevBound, 1);
            cfg.map.removeLayer(cfg.markers[entry.entryID].layer);
            fitBoundaries();
        }
    }

    /**
     * Pan to a marker symbolizing an entry.
     * @param {JSON} entry Structure of an object
     */
    function panToMarker(entry) {
        if (cfg.markers[entry.entryID]) {
            var latLng = [entry.location.latitude, entry.location.longitude];

            cfg.markers[entry.entryID].layer.openPopup();
            cfg.map.panTo(latLng);
        }
    }

    /**
     * Find the index of the matching marker in the boundaries (for update or removal).
     * @param {JSON}     entry Structure of an object
     * @return {Integer}       The position of the matching coordinates in the array
     */
    function findInBoundaries(entry) {
        if (cfg.markers[entry.entryID]) {
            var prevCoords  = cfg.markers[entry.entryID].layer.getLatLng(),
                prevLatLng  = prevCoords.lat + ',' + prevCoords.lng,
                i           = 0,
                boundariesL = cfg.boundaries.length;

            // Find and replace the coordinates in the boundaries, then fit again.
            for (; i < boundariesL; i++) {
                if (prevLatLng === cfg.boundaries[i].join(',')) {
                    break;
                }
            }

            return i - 1;
        }
    }

    /**
     * Fit the view so that all markers are visible.
     */
    function fitBoundaries() {
        if (0 < cfg.boundaries.length) {
            cfg.map.fitBounds(cfg.boundaries);
        }
    }

// *************************************************************************************************
// actions
// *************************************************************************************************

    /**
     * Handle actions made on entries or other data related objects.
     * @param  {Event} target Target of the current event
     */
    function handleActions(target) {
        var $collapsable = $(target).closest(cfg.select.classes.canCollapse),
            $entryID = parseInt($collapsable.attr('id').replace(cfg.entryIDSuf, '')),
            action   = $(target).data('action');

        switch (action) {
            case 'delete':
                removeEntry($entryID);
                break;
            case 'edit':
                showEditForm($entryID);
                $collapsable.find(cfg.select.classes.collapseTrigger).removeClass(cfg.classes.collapseTrigger);
                break;
            case 'submit':
                $collapsable = editEntry($entryID);
                showClickable($collapsable)
                    .addClass(cfg.classes.state)
                    .find(cfg.select.classes.collapseTrigger)
                        .addClass(cfg.classes.collapseTrigger);
                break;
        }
    }

    /**
     * Show the form to edit an entry.
     * @param {Integer} entryID ID of the entry to edit
     */
    function showEditForm(entryID) {
        var $entryDOM = $('#' + cfg.entryIDSuf + entryID),
            form      = templatize(
                cfg.templates.editEntry.id,
                JSON.parse(localStorage.getItem(entryID))
            );

        $entryDOM.html(form);
        setHeight($entryDOM);
    }

// *************************************************************************************************
// ui
// *************************************************************************************************

    /**
     * Populate a template with some data
     * @param  {String} tpl  ID selector for the template.
     * @param  {JSON}   data Data to be passed to the template.
     * @return {jQuery}      Rendered templates as a jQuery object.
     */
    function templatize(tpl, data) {
        var output = jsviews.render[tpl](data);

        return output;
    }

    /**
     * Give visual hints that some content is actionable through JS.
     * @param {jQuery} $objects Containers following the template for entries.
     */
    function showClickable($objects) {
        $objects.find(cfg.select.classes.collapseTrigger).addClass(cfg.classes.canClick);

        return $objects;
    }

    /**
     * Set height fot targeted element.
     * @param {jQuery} $container Object representing DOM elements.
     */
    function setHeight($container) {
        var headerH  = $container.find(cfg.select.classes.collapseTrigger).outerHeight(true),
            contentH = $container.find(cfg.select.classes.collapseToggled).outerHeight(true);

        if ($container.hasClass(cfg.classes.state)) {
            $container.height(headerH + contentH + 'px');
        } else {
            $container.height(headerH + 'px');
        }

        return $container;
    }

    /**
     * Test if notifications are allowed and ask in case they’re not.
     */
    function requestNotificationPermission() {
        if (window.Notification) {
            // giveFeedback('Notification.permission: ' + Notification.permission, 'info');

            if ('default' === Notification.permission) {
                Notification.requestPermission();
            }
        }
    }

    /**
     * Inform the user about what’s been done. This is an alternative to browser notifications if
     *     they are not available or allowed.
     * @param  {String} msg  The content of the feedback.
     * @param  {String} type The type of feeback we supply: error, info or warning.
     */
    function giveFeedback(msg, type) {
        var entry = templatize(cfg.templates.feedbackEntry.id,
                               {
                                   'type': type,
                                   'msg': msg
                               }),
            $feedbacks = $('#' + cfg.ids.feedbacks);

        if (!$feedbacks.children().length) {
            $feedbacks.prepend(
                $('<a/>', {
                    class:         cfg.classes.closeAll + ' ' + cfg.classes.canClick,
                    title:         'Close all notifications.',
                    text:          '×',
                    'data-action': 'closeFeedbacks'
                })
            );
        }

        $feedbacks.prepend(entry);
    }

    /**
     * Close a specific feedback.
     * @param  {DOM} feedback Element targetted.
     */
    function closeFeedback(feedback) {
        var $feedback = $(feedback);

        if (0 === $feedback.siblings(cfg.select.classes.feedback).length) {
            closeFeedbacks();
        } else {
            $feedback.remove();
        }
    }

    /**
     * Close all feedbacks.
     */
    function closeFeedbacks() {
        $('#' + cfg.ids.feedbacks).empty();
    }

    /**
     * Pushes a notification to the browser that will be displayed to the user if this one allows it.
     * @param  {String} body  Describe what happened and eventually what needs to be done.
     *
     * @option {String} type  Set the type of notification: error, warning or default (success).
     * @option {String} title Set the title for the notification box (Default will be set if null).
     */
    function notifyUser(body) {
        var argumentsL = arguments.length,
            icon       = "img/dialog-information.svg",
            title      = 'Good!',
            type       = 'default',
            notification;

        if (2 === argumentsL) {
            type = arguments[1];
            switch (type) {
                case 'error':
                    icon  = "img/dialog-error.svg";
                    title = 'Oopsie…';
                    break;
                case 'warning':
                    icon  = "img/dialog-warning.svg";
                    title = 'Something’s kinda wrong (but not broken)!';
                    break;
            }
        }

        if (3 === argumentsL) {
            title = arguments[2];
        }

        if (window.Notification) {
            notification = new Notification(
                title,
                {
                    icon: icon,
                    body: body
                });
        }

        if (!Notification.permission || true === cfg.debug) {
            giveFeedback(body, type, title);
        }
    }

// *************************************************************************************************
// debug
// *************************************************************************************************

    /**
     * Log a list of entries in the local storage.
     */
    function listEntries() {
        console.log('entries in localStorage: ', localStorage);
        console.log('entries in getEntries(): ', getEntries());
    }

    /**
     * Clear all content from localStorage.
     */
    function clearLocalStorage() {
        $(cfg.select.classes.entry).remove();
        $.each(getEntries(), function (i, entry) {
            removeMarker(entry);
        });
        cfg.counter = 0;
        localStorage.clear();
        notifyUser('local storage cleared');
    }

    /**
     * Create dummy entries to ease development.
     */
    function populate() {
        var dummyEntries = [
            {
                'title':       'Test of HTML in the description!',
                'description': 'let’s write something (again)…The following object will populate a template:\n' +
                               '<code><pre>var entries = [{\n' +
                               '  \'entryId\'     : 1,\n' +
                               '  \'title\'       : \'Entry generated with a JS object\',\n' +
                               '  \'description\' : \'The following object will populate a template:\'\n' +
                               '  [rince and repeat…]\n' +
                               '}]</pre></code>',
                'location':    {
                    "latitude":  30,
                    "longitude": 120,
                    "altitude":  20,
                    "accuracy":  30
                }
            },
            {
                'title':       'One more tiiiiime!',
                'description': 'Pour faiiiire un succès de laaaaarmes !',
                'location':    {
                    "latitude":  35,
                    "longitude": 125,
                    "altitude":  0,
                    "accuracy":  53
                }
            },
            {
                'title':       'Le poinçonneur des Lilas',
                'description': 'Des p’tits trous, des p’tits trous&nbsp;! Toujours des p’tits trous…',
                'location':    {
                    "latitude":  35,
                    "longitude": 130,
                    "altitude":  60,
                    "accuracy":  10
                }
            }
        ];

        $.each(dummyEntries, function (i, entry) {
            dummyEntries[i].entryID = 1 + cfg.counter;
            dummyEntries[i].time    = new Date().getTime();

            updateEntryInDB(entry);
            addMarker(entry);
        });

        addEntryToDOM(dummyEntries);

        notifyUser('Dummy entries were added!');
    }

// *************************************************************************************************
// public variables
// *************************************************************************************************
    // Stop script if a depency is missing.
    if (!testDependencies()) {
        return ('Oooopsie! Some dependencies are missing!');
    }

    // Initialize the layout and logic on the page.
    init();

    // Make some values public.
    return {
        cfg: cfg,
        listEntries: listEntries,
        populate: populate,
        clearLocalStorage: clearLocalStorage,
        closeFeedback: closeFeedback,
        closeFeedbacks: closeFeedbacks
    };
})();
