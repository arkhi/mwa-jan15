var myLittleDiary = (function(){
  var cfg = {
    debug: true,
    selectDevActions: '#dev-actions',
    selectDevAction:  '.action',

    classCanCollapse: 'can-collapse',
    classClickable:   'can-click',
    classState:       'open',

    selectTopEventHandler: '.entries',
    selectTitles:          '.collapse-toggle',
    selectDescriptions:    '.collapse-toggled',
    selectActionDelete:    '.action-delete',
    selectActionEdit:      '.action-edit',

    selectFormPostEntry:   '#post-entry',
    selectFormTitle:       '#title',
    selectFormDesc:        '#description',
    selectFormLocation:    '#location',

    entryIDSuf: 'entry-',
    tplEntry:   '#tpl-entry',

    mapID:       'map',
    selectMap:   '#map',
    hasLocation: false,
    geoOptions:  {
      enableHighAccuracy: true,
      maximumAge : 30000,
      timeout : 27000
    },

    dependencies:          [
      'jQuery',
      jQuery.templates,
      'localStorage'
    ],
  }

  cfg.selectContainers = '.' + cfg.classCanCollapse;
  cfg.counter = localStorage['counter'] ? parseInt(localStorage['counter']) : 0;

  /**
   * Check that dependies are met.
   * @param  {array}  Orderedlist of window properties or variables.
   * @return {string} Message explaining which dependency is missing.
   */
  $(cfg.dependencies).each(function(){
    if(undefined === typeof window[this] || undefined === typeof this) {
      var error = this + ' is a missing dependency!';
      console.log(error);
      return error;
    }
  })

  /**
   * Launch basic setup for the application.
   */
  var init = function init(){
    if (cfg.debug) {
      $('html').addClass('debug');
    };
    var $containers = $(cfg.selectContainers);

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
      $containers.each(function(){
        showClickable($(this));
        setHeight($(this));
      });

      $(cfg.selectTopEventHandler).on('click', cfg.selectTitles, function(){
        var $article = $(this).closest(cfg.selectContainers);
        $article.toggleClass(cfg.classState);
        setHeight($article);
      });

      $(cfg.selectTopEventHandler).on('click', cfg.selectActionDelete, function(event){
        event.preventDefault();
        var $article = $(this).closest(cfg.selectContainers),
            entryID  = $article.attr('id').replace(cfg.entryIDSuf, '');

        removeEntry(entryID);
      });

      displayLocalEntries();

      testNotifications();

      placeMarkers(drawMap());

      $(cfg.selectDevActions).on('click', cfg.selectDevAction, function(){
        myLittleDiary[$(this).data('action')]();
      });
    });

    /**
     * Check if some entries were added dynamicaly
     * @param {object} data jQuery objects to operate on.
     */
    $(cfg.selectTopEventHandler).on('entryAdded', function(event, data){
      showClickable(data.objects);
    });

    $(cfg.selectFormPostEntry).on('submit click', function(event){
      event.preventDefault();
      postEntry();
    });
  }

  /**
   * Populate a template with sone Data
   * @param  {String} tpl  jQuery selector for the template.
   * @param  {JSON}   data Data to be passed to the template.
   * @return {jQuery}      Rendered templates as a jQuery object.
   */
  var templatize = function templatize(tpl, entry) {
    var $templateEntry = $.templates(tpl),
        output         = $templateEntry.render(entry);

    return output;
  };

  /**
   * Display entries stored in the local storage.
   */
  var displayLocalEntries = function displayLocalEntries() {
    addEntryToDOM(getEntriesFromDB());
  }

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
  }

  /**
   * Get location based on environment and user interaction.
   * @return {Promise} A deferred object to be used by the caller.
   */
  var getLocation = function getLocation() {
    var checking = new $.Deferred();

    function getLocationSuccess(position) {
      var latitude = position.coords.latitude;
      var longitude = position.coords.longitude;
      var altitude = position.coords.altitude;
      var accuracy = position.coords.accuracy;

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
          errorMsg = 'We could not get your location because the operation timed out. You might try'
                   + ' to edit your post later.';
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
   * Draw maps corresponding to locations.
   */
  var drawMap = function drawMap() {
    var map = L.map(cfg.mapID).setView([0, 0], 13);

    L.tileLayer('https://{s}.tiles.mapbox.com/v3/{id}/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
        '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
        'Imagery © <a href="http://mapbox.com">Mapbox</a>',
      id: 'examples.map-i875mjb7'
    }).addTo(map);

    return map;
  };

  /**
   * Place markers on the map for each entry.
   * @param  {Map} map A Leaflet Map object.
   */
  var placeMarkers = function placeMarkers(map) {
    var boundaries = [];

    $.each(getEntriesFromDB(), function(i, entry){
      if (entry.location) {
        var lat    = entry.location.latitude,
            lon    = entry.location.longitude,
            marker = L.marker([lat, lon]).addTo(map);

        marker.bindPopup('<b>' + entry.title + '</b>').openPopup();
        boundaries.push([lat,lon]);
      }
    });

    if (boundaries.length) {
      map.fitBounds(boundaries);
    }
  };

  /**
   * Create a new entry based on the form.
   * Show it on the document.
   * Store it into DB.
   * Notify user!
   */
  var postEntry = function postEntry() {
    var titleVal     = $(cfg.selectFormTitle).val(),
        descVal      = $(cfg.selectFormDesc).val(),
        useLocation = $(cfg.selectFormLocation).prop('checked');

    if (!titleVal || !descVal) {
      return;
    };

    function processPost(answer) {
      data = {
        'entryID':     cfg.counter + 1,
        'title':       titleVal,
        'description': descVal,
        'location':    answer.location
      };

      addEntryToDOM([data]);
      storeEntry(data);
      notifyUser('Your entry was posted successfully! ' + answer.msg);
    }

    if (true === useLocation) {
      getLocation(useLocation)
        .progress(function(answer){
          console.log(answer);
        })
        .done(function(answer){
          console.log(answer);
          processPost(answer);
        })
        .fail(function(answer){
          console.log(answer);
          processPost(answer);
        });
    } else {
      processPost(false);
    }
  }

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
        output.push(templatize(cfg.tplEntry, entry));
        objectsId.push('#' + cfg.entryIDSuf + entry.entryID);
      });
    } catch (error) {
      throw('Data provided is not an array with at least one entry.');
    }


    // Add all objects to DOM, and let event listener know we added specific entries.
    $(cfg.selectTopEventHandler).prepend(output.reverse())
                                .trigger('entryAdded', [{
                                  objects: $(objectsId.join(', '))
                                }]);
  };

  /**
   * Store entry in the local storage and increment the counter.
   * @param  {Object} data JSON string describing the object to store.
   */
  var storeEntry = function storeEntry(data) {
    try {
      localStorage.setItem(cfg.counter + 1, JSON.stringify(data));
      localStorage.setItem('counter', ++cfg.counter);
    } catch (e) {
      notifyUser('Sorry, there was a problem while submitting your entry, please check console log.',
                 'warning');
    }
  };

  /**
   * Remove an entry from the document.
   * Remove it into DB.
   * Notify user!
   */
  var removeEntry = function removeEntry(entryID) {
    var title = JSON.parse(localStorage.getItem(entryID)).title;

    removeEntryFromDOM(entryID);
    removeEntryFromDB(entryID);

    notifyUser('The post “' + title + '” was removed successfully!');
  };

  /**
   * Remove and entry from the DOM or notify the user if a problem occured.
   * @param  {Integer} entryID ID associated with the entry
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
   * @param  {Integer} entryID ID associated with the entry
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
   * Get an entry’s ID.
   * @param  {Integer} index Any valid key defining an object in the local storage.
   * @return {Object}        Item and its properties: values.
   */
  var getEntryID = function getEntryID(index) {
    var item = JSON.parse(localStorage.key(index));

    if(!item) throw('No item found!');

    return item.entryID;
  }

  /**
   * Log a list of entries in the local storage.
   */
  var listEntries = function listEntries() {
    console.log('entries in localStorage: ', localStorage);
    console.log('entries in getEntriesFromDB(): ', getEntriesFromDB());
  }

  /**
   * Clear all content from localStorage.
   */
  var clearLocalStorage = function clearLocalStorage() {
    localStorage.clear();
    $(cfg.selectContainers).remove();
    notifyUser('local storage cleared');
  }

  /**
   * Give visual hints that some content is actionable through JS.
   * @param {jQuery} $objects Containers following the template for entries.
   */
  var showClickable = function showClickable($objects) {
    $objects.find(cfg.selectTitles).addClass(cfg.classClickable);
    setHeight($objects);
  }

  /**
   * Set height fot targeted element.
   * @param {jQuery} $container Object representing DOM elements.
   */
  var setHeight = function setHeight($container) {
    var headerH  = $container.find(cfg.selectTitles).outerHeight(true),
        contentH = $container.find(cfg.selectDescriptions).outerHeight(true);

    if($container.hasClass(cfg.classState)) {
      $container.height(headerH + contentH + 'px');
    } else {
      $container.height(headerH + 'px');
    }
  };

  /**
   * Test if notifications are allowed and ask in case they’re not.
   */
  var testNotifications = function() {
    console.log('Notification.permission: ' + Notification.permission);
    if('default' === Notification.permission) {
      Notification.requestPermission();
    }
  }

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
          "latitude":41.2125227,
          "longitude":21.45133369999999,
          "altitude":20,
          "accuracy":30
        }
      },
      {
        'entryID':     cfg.counter + 2,
        'title':       'One more tiiiiime!',
        'description': 'Pour faiiiire un succès de laaaaarmes !',
        'location':    {
          "latitude":61.2125227,
          "longitude":-21.45133369999999,
          "altitude":0,
          "accuracy":53
        }
      },
      {
        'entryID':     cfg.counter + 3,
        'title':       'Le poinçonneur des Lilas',
        'description': 'Des p’tits trous, des p’tits trous ! Toujours des p’tits trous…',
        'location':    {
          "latitude":-31.2125227,
          "longitude":-121.45133369999999,
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
// init and public variables
// -------------------------------------------------------------------------------------------------

  // Initialize the layout and behaviors on the page.
  init();

  // Make some values public.
  return {
    listEntries: listEntries,
    populate: populate,
    clearLocalStorage: clearLocalStorage
  };
})();
