var myLittleDiary = (function(){
    var cfg = {
        debug: false,
        selectDevActions: '#dev-actions',
        selectDevAction:  '.action',

        classCanCollapse:     'can-collapse',
        classClickable:       'can-click',
        classCollapseTrigger: 'collapse-trigger',
        classState:           'open',

        selectContainers:       '.entry',
        selectCanCollapse:      '.can-collapse',
        selectEntriesContainer: '.entries',
        selectCollapseToggle:   '.collapse-trigger',
        selectCollapseToggled:  '.collapse-target',
        selectAction:           '.action',

        selectFormPostEntry: '#post-entry',
        selectFormTitle:     '#title',
        selectFormDesc:      '#description',
        selectFormLocation:  '#location',

        templates:  {
            entry: {
                id: 'tpl-entry'
            },
            editEntry: {
                id: 'tpl-edit-entry'
            }
        },
        entryIDSuf: 'entry-',

        map:         null,
        selectMap:   '#map',
        classMapOK:  'has-content',
        hasLocation: false,
        geoOptions:  {
            enableHighAccuracy: true,
            maximumAge : 30000,
            timeout : 27000
        },
        markers: [],
        boundaries: [],

        dependencies: [
            'jsviews',
            'jQuery',
            'localStorage'
        ],

        defaultEntry: {
            'entryID':     null,
            'title':       null,
            'description': null,
            'location':    false
        }
    };

    cfg.counter = localStorage['counter'] ? parseInt(localStorage['counter']) : 0;

    /**
     * Check that dependies are met.
     * @param  {array}   dependencies Methods needed for this application to run
     * @return {boolean}              Can we launch the app?
     */
    var testDependencies = function testDependencies() {
        var i, depLength = cfg.dependencies.length;

        for (i = 0; i < depLength; i++) {
            if('undefined' === typeof window[cfg.dependencies[i]]) {
                var error = 'This application needs ' + cfg.dependencies[i] + ' (and it cannot be found).';
                notifyUser(error, 'error');
                return false;
            }
        }

        return true;
    };

    /**
     * Launch basic setup for the application.
     */
    var init = function init(){
        // Stop script if a depency is missing.
        if(!testDependencies()) {
            return ('Oooopsie! Some dependencies are missing!');
        }

        var $containers = $(cfg.selectCanCollapse);

        // Reset heights when the window is resized or the orientation changes.
        $(window).on('resize', function(){
            $containers.each(function(){
                setHeight($(this));
            });
        });

        // Collapse all contents.
        // Show the user they can click on titles.
        // Set default heights.
        // Toggle classes and compute heights on click.
        $(document).ready(function(){
            // Collapse collapsable items.
            $containers.each(function(){
                showClickable($(this));
                setHeight($(this));
            });

            // Handle collapsable items.
            $(cfg.selectEntriesContainer).on('click', cfg.selectCollapseToggle, function(){
                var $collapsable = $(this).closest(cfg.selectCanCollapse);
                $collapsable.toggleClass(cfg.classState);
                setHeight($collapsable);
                panTo(getEntry($collapsable.attr('id').replace(cfg.entryIDSuf, '')));
            });

            // Handle actions on entries.
            $(cfg.selectEntriesContainer).on('click', cfg.selectAction, function(event){
                event.preventDefault();

                handleActions(this);
            });

            // Handle dev tools and related actions.
            if (cfg.debug) {
                $('html').addClass('debug');
            };
            $(cfg.selectDevActions).on('click', cfg.selectDevAction, function(){
                myLittleDiary[$(this).data('action')]();
            });

            // Test status for notifications.
            testNotifications();

            // Register templates.
            $.each(cfg.templates, function(tpl){
                jsviews.templates(cfg.templates[tpl].id, $('#' + cfg.templates[tpl].id).html());
            });

            // Display entries in localStorage.
            displayLocalEntries();

            // Draw map with markers.
            placeMarkers(drawMap(cfg.selectEntriesContainer));
        });

        /**
         * Check if some entries were added dynamicaly
         * @param {object} data jQuery objects to operate on.
         */
        $(cfg.selectEntriesContainer).on('entryAdded', function(event, data){
            showClickable(data.objects);
            setHeight(data.objects);
        });

        $(cfg.selectFormPostEntry).on('submit click', function(event){
            event.preventDefault();
            postEntry();
        });
    };

    /**
     * Populate a template with sone Data
     * @param  {String} tpl   ID selector for the template.
     * @param  {JSON}   entry Data to be passed to the template.
     * @return {jQuery}       Rendered templates as a jQuery object.
     */
    var templatize = function templatize(tpl, entry) {
        var output = jsviews.render[tpl](entry);

        return output;
    };

    /**
     * Display entries stored in the local storage.
     */
    var displayLocalEntries = function displayLocalEntries() {
        addEntryToDOM(getEntriesFromDB());
    };

    /**
     * Returns all valid entries in the local storage.
     * @return {Array} Array of valid entries.
     */
    var getEntriesFromDB = function getEntriesFromDB() {
        var entries = [];

        // Apparently, entries are still present in the localStorage somehow, so looping with .length
        // will return as much  missing entries as there was removed items.
        for (var i = 0; i <= cfg.counter; i++) {
            var entry = {},
                v     = localStorage.getItem(i);

            if (undefined !== v && v) {
                entry = JSON.parse(v);
            }

            if (entry.entryID) {
                entries.push(entry);
            }
        }

        return entries;
    };

    /**
     * Get location based on environment and user interaction.
     * @return {Promise} A deferred object to be used by the caller.
     */
    var getLocation = function getLocation() {
        var checking = new $.Deferred();

        function getLocationSuccess(position) {
            var latitude  = position.coords.latitude;
            var longitude = position.coords.longitude;
            var altitude  = position.coords.altitude;
            var accuracy  = position.coords.accuracy;

            var location = {
                latitude: latitude,
                longitude: longitude,
                altitude: altitude,
                accuracy: accuracy
            }

            checking.resolve({
                msg: 'Got your location!',
                location: location
            });
        }

        function getLocationError(error) {
            switch (error.code) {
                case 1:
                    errorMsg = 'As defined in your settings, your location won’t be shared.';
                    break;
                case 2:
                    errorMsg = 'Your location is not available at the moment.';
                    break;
                case 3:
                    errorMsg = 'We could not get your location because the operation timed out. '
                             + 'You might try to edit your post later.';
                    break;
            }

            checking.resolve({
                msg: errorMsg,
                location: false
            });
        }

        function waiting() {
            if ('pending' === checking.state()) {
                checking.notify('Waiting for user and browser to take action.');
            }
        }

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(getLocationSuccess, getLocationError, cfg.geoOptions);
        }

        return checking.promise();
    };

    /**
     * Update the location after an entry has been posted or updated.
     * @param  {Integer} entryID ID of an entry
     */
    var updateLocation = function updateLocation(entryID) {
        var entry = JSON.parse(localStorage.getItem(entryID));

        return getLocation()
            .progress(function(answer){
                console.log(answer.msg);
            })
            .done(function(answer){
                entry.location = answer.location;
                storeEntry(entry, entryID);
                console.info('The location for “' + entry.title + '” has been updated.');
            })
            .fail(function(answer){
                notifyUser('Your location could not be updated: ' + answer.msg);
            });
    };

    /**
     * Draw a map.
     * @return {map} Leaflet map object
     */
    var drawMap = function drawMap() {
        // Test availability for leaflet and stop here if it is not available.
        // Let CSS know it can style the map if leaflet is here.
        try {
            L.version;
            $(cfg.selectMap).addClass(cfg.classMapOK);
        } catch (e) {
            throw(e.message);
        }

        cfg.map = L.map('map').setView([0, 0], 13);

        L.tileLayer('https://{s}.tiles.mapbox.com/v3/{id}/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
                '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
                'Imagery © <a href="http://mapbox.com">Mapbox</a>',
            id: 'examples.map-i875mjb7'
        }).addTo(cfg.map);

        return cfg.map;
    };

    /**
     * Place markers on the map for each existing entry.
     * Fit the map so that all markers are visible.
     * @param  {Map} map Leaflet Map object.
     */
    var placeMarkers = function placeMarkers() {
        if(undefined === cfg.map) {
            throw('"map" is not defined.');
        }

        $.each(getEntriesFromDB(), function(i, entry){
            if (entry.location) {
                var lat    = entry.location.latitude,
                    lon    = entry.location.longitude;

                addMarker(entry);
            }
        });
    };

    /**
     * Pan to a marker symbolizing an entry.
     * @param {JSON} entry Structure of an object
     */
    var panTo = function panTo(entry) {
        var latLng = [entry.location.latitude, entry.location.longitude];

        cfg.markers[entry.entryID].openPopup();
        cfg.map.panTo(latLng);
    }

    /**
     * Add a marker for a newly created entry.
     * @param {JSON} entry Structure of an object
     */
    var addMarker = function addMarker (entry) {
        var latLng = [entry.location.latitude, entry.location.longitude];

        cfg.markers[entry.entryID] = L.marker(latLng).addTo(cfg.map);
        cfg.markers[entry.entryID].bindPopup('<b>' + entry.title + '</b>').openPopup();
        cfg.boundaries.push(latLng);
        cfg.map.fitBounds(cfg.boundaries);
    }

    /**
     * Update a marker to match new geolocation.
     * @param {JSON} entry Structure of an object
     */
    var updateMarker = function updateMarker (entry) {
        var prevCoords  = cfg.markers[entry.entryID].getLatLng(),
            prevLatLng  = prevCoords.lat + ',' + prevCoords.lng,
            latLng      = [entry.location.latitude, entry.location.longitude],
            i           = 0,
            boundariesL = cfg.boundaries.length;

        cfg.markers[entry.entryID].setLatLng(latLng).openPopup();

        // Find and replace the coordinates in the boundaries, then fit again.
        for (; i < boundariesL; i++) {
            if (prevLatLng === cfg.boundaries[i].join(',')) {
                break;
            }
        };
        cfg.boundaries.splice(i - 1, 1, latLng)
        cfg.map.fitBounds(cfg.boundaries);
    }

    /**
     * Create a new entry based on the form.
     * Show it on the document.
     * Store it into DB.
     * Notify user!
     */
    var postEntry = function postEntry() {
        var entry = cfg.defaultEntry;

        entry.entryID     = cfg.counter + 1;
        entry.title       = $(cfg.selectFormTitle).val();
        entry.description = $(cfg.selectFormDesc).val();

        useLocation = $(cfg.selectFormLocation).prop('checked');

        if (!entry.title || !entry.description) {
            return;
        };

        addEntryToDOM([entry]);
        storeEntry(entry);
        notifyUser('Your entry was posted successfully!');

        if (true === useLocation) {
            updateLocation(entry.entryID).done(function(){
                addMarker(entry);
                panTo(entry);
            });
        }
    };

    /**
     * Add entry in the list of existing queries.
     * @param {Array} data Contains the structure of entries to fill in the template.
     */
    var addEntryToDOM = function addEntryToDOM(entries) {
        var output    = [],
            objectsId = [];

        // Create new objects and their references based on entries and templates.
        try {
            $.isArray(entries);
            $.each(entries, function(i, entry){
                output.push(templatize(cfg.templates['entry'].id, entry));
                objectsId.push('#' + cfg.entryIDSuf + entry.entryID);
            });
        } catch (e) {
            throw('Data provided is not an array with at least one entry: ' + e);
        }

        // Add all objects to DOM, and let event listener know we added specific entries.
        $(cfg.selectEntriesContainer)
            .prepend(output.reverse())
            .trigger('entryAdded', [{
                objects: $(objectsId.join(', '))
            }]);
    };

    /**
     * Store entry in the local storage and increment the counter.
     * @param {Object} data JSON string describing the object to store.
     *
     * @param {Integer}     Optional entry ID
     */
    var storeEntry = function storeEntry(data) {
        var entryID = cfg.counter + 1;

        if(1 < arguments.length) {
            entryID = arguments[1];
        }

        try {
            localStorage.setItem(entryID, JSON.stringify(data));
            localStorage.setItem('counter', ++cfg.counter);
        } catch (e) {
            notifyUser('Sorry, there was a problem while submitting your entry, '
                     + 'please check console log.',
                       'warning');
        }
    };

    /**
     * Handle actions made on entries or other data related objects.
     * @param  {Event} target Target of the current event
     */
    var handleActions = function handleActions(target) {
        var $collapsable = $(target).closest(cfg.selectCanCollapse),
            $entryID = $collapsable.attr('id').replace(cfg.entryIDSuf, ''),
            action   = $(target).data('action');

        switch(action) {
            case 'delete':
                removeEntry($entryID);
                break;
            case 'edit':
                showEditForm($entryID);
                $collapsable.find(cfg.selectCollapseToggle).removeClass(cfg.classCollapseTrigger);
                break;
            case 'submit':
                $collapsable = editEntry($entryID);
                showClickable($collapsable)
                    .addClass(cfg.classState)
                    .find(cfg.selectCollapseToggle)
                        .addClass(cfg.classCollapseTrigger);
                break;
        }
    };

    /**
     * Show the form to edit an entry.
     * @param {Integer} entryID ID of the entry to edit
     */
    var showEditForm = function showEditForm(entryID) {
        var $entryDOM = $('#' + cfg.entryIDSuf + entryID),
            form      = templatize(
                cfg.templates['editEntry'].id, 
                JSON.parse(localStorage.getItem(entryID))
            );

        $entryDOM.html(form);
        setHeight($entryDOM);
    };

    /**
     * Edit the content of an entry.
     * @param {Integer} entryID ID of the entry to edit
     */
    var editEntry = function editEntry(entryID) {
        var entry       = cfg.defaultEntry,
            $entryDOM   = $('#' + cfg.entryIDSuf + entryID),
            useLocation = $(cfg.selectFormLocation + '-' + entryID).prop('checked');

        entry.entryID     = entryID;
        entry.title       = $(cfg.selectFormTitle + '-' + entryID).val();
        entry.description = $(cfg.selectFormDesc + '-' + entryID).val();
        entry.location    = getEntry(entryID).location;

        if (!entry.title || !entry.description) {
            return;
        };

        if (true === useLocation) {
            updateLocation(entryID).done(function(){
                updateMarker(entry);
                panTo(entry);
            });
        }

        var $output = $(templatize(
            cfg.templates['entry'].id,
            entry
        ));

        storeEntry(entry, entryID);
        $entryDOM.replaceWith($output);
        notifyUser('Your entry was updated successfully!');

        return $output;
    };

    /**
     * Remove an entry from the document.
     * Remove it into DB.
     * Notify user!
     * @param {Integer} entryID ID of the entry to remove
     */
    var removeEntry = function removeEntry(entryID) {
        var title = JSON.parse(localStorage.getItem(entryID)).title;

        removeEntryFromDOM(entryID);
        removeEntryFromDB(entryID);

        notifyUser('The post “' + title + '” was removed successfully!');
    };

    /**
     * Remove and entry from the DOM or notify the user if a problem occured.
     * @param {Integer} entryID ID of the entry to remove
     */
    var removeEntryFromDOM = function removeEntryFromDOM(entryID) {
        try {
            $('#' + cfg.entryIDSuf + entryID).remove();
        } catch (exception) {
            notifyUser('Sorry, the entry could not be removed from the DOM.',
                       'error');
            throw(exception.message);
        }
    };

    /**
     * Remove an entry from the local storage or notify the user if a problem occured.
     * @param {Integer} entryID ID of the entry to remove
     */
    var removeEntryFromDB = function removeEntryFromDB(entryID) {
        try {
            localStorage.removeItem(entryID);
        } catch (exception) {
            notifyUser('Sorry, the entry could not be removed from the DB.',
                       'error');
            throw(exception.message);
        }
    };

    /**
     * Get any entry.
     * @param  {Integer} key Any valid key defining an object in the local storage.
     * @return {Object}      Item and its properties:values.
     */
    var getEntry = function getEntry(key) {
        var item = JSON.parse(localStorage.getItem(key));

        if(!item) throw('No item found!');

        return item;
    };

    /**
     * Log a list of entries in the local storage.
     */
    var listEntries = function listEntries() {
        console.log('entries in localStorage: ', localStorage);
        console.log('entries in getEntriesFromDB(): ', getEntriesFromDB());
    };

    /**
     * Clear all content from localStorage.
     */
    var clearLocalStorage = function clearLocalStorage() {
        localStorage.clear();
        $(cfg.selectContainers).remove();
        cfg.counter = 0;
        notifyUser('local storage cleared');
    };

    /**
     * Give visual hints that some content is actionable through JS.
     * @param {jQuery} $objects Containers following the template for entries.
     */
    var showClickable = function showClickable($objects) {
        $objects.find(cfg.selectCollapseToggle).addClass(cfg.classClickable);

        return $objects;
    };

    /**
     * Set height fot targeted element.
     * @param {jQuery} $container Object representing DOM elements.
     */
    var setHeight = function setHeight($container) {
        var headerH  = $container.find(cfg.selectCollapseToggle).outerHeight(true),
            contentH = $container.find(cfg.selectCollapseToggled).outerHeight(true);

        if($container.hasClass(cfg.classState)) {
            $container.height(headerH + contentH + 'px');
        } else {
            $container.height(headerH + 'px');
        }
    };

    /**
     * Test if notifications are allowed and ask in case they’re not.
     */
    var testNotifications = function testNotifications() {
        console.log('Notification.permission: ' + Notification.permission);

        if('default' === Notification.permission) {
            Notification.requestPermission();
        }
    };

    /**
     * Pushes a notification to the browser that will be displayed to the user if this one allows it.
     * @param  {String} body  Describe what happened and eventually what needs to be done.
     *
     * @option {String} type  Set the type of notification: error, warning or default (success).
     * @option {String} title Set the title for the notification box (Default will be set if null).
     */
    var notifyUser = function notifyUser(body) {
        var argumentsL = arguments.length,
            icon       = "img/dialog-information.svg",
            title      = 'Good!';

        if(2 === argumentsL) {
            switch(arguments[1]) {
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

        var notification = new Notification(
            title,
            { 
                icon: icon,
                body: body
            });

        console.log(body);
    };

    /**
     * Create dummy entries to ease development.
     */
    var populate = function populate() {
        var dummyEntries = [
            {
                'entryID':     cfg.counter + 1,
                'title':       'Test of HTML in the description!',
                'description': 'let’s write something (again)…The following object will populate a template:\n'
                                         + '<code><pre>var entries = [{\n'
                                         + '  \'entryId\'     : 1,\n'
                                         + '  \'title\'       : \'Entry generated with a JS object\',\n'
                                         + '  \'description\' : \'The following object will populate a template:\'\n'
                                         + '  [rince and repeat…]\n'
                                         + '}]</pre></code>',
                'location':    {
                    "latitude":30,
                    "longitude":120,
                    "altitude":20,
                    "accuracy":30
                }
            },
            {
                'entryID':     cfg.counter + 2,
                'title':       'One more tiiiiime!',
                'description': 'Pour faiiiire un succès de laaaaarmes !',
                'location':    {
                    "latitude":35,
                    "longitude":125,
                    "altitude":0,
                    "accuracy":53
                }
            },
            {
                'entryID':     cfg.counter + 3,
                'title':       'Le poinçonneur des Lilas',
                'description': 'Des p’tits trous, des p’tits trous ! Toujours des p’tits trous…',
                'location':    {
                    "latitude":35,
                    "longitude":130,
                    "altitude":60,
                    "accuracy":10
                }
            },
        ];

        $.each(dummyEntries, function(i, entry){
            storeEntry(entry);
        });

        addEntryToDOM(dummyEntries);
        notifyUser('Dummy entries were added!');
    }

// -------------------------------------------------------------------------------------------------
// public variables
// -------------------------------------------------------------------------------------------------
    // Initialize the layout and logic on the page.
    init();

    // Make some values public.
    return {
        cfg: cfg,
        init: init,
        listEntries: listEntries,
        populate: populate,
        clearLocalStorage: clearLocalStorage
    };
})();
