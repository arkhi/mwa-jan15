var myLittleDiary = (function(){
  var cfg = {
    classCanCollapse: 'can-collapse',
    classClickable:   'can-click',
    classState:       'open',

    selectTitles:          '.collapse-toggle',
    selectDescriptions:    '.collapse-toggled',
    selectTopEventHandler: '.entries',
    selectFormPostEntry:   '#post-entry',
    selectFormTitle:       '#title',
    selectFormDesc:        '#description',
    selectFormLocation:    '#location',

    entryIDSuf: 'entry-',
    tplEntry:   '#tpl-entry',

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

      displayLocalEntries();
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
   * Add entry in the list of existing queries.
   * @param {Array} data Contains the structure of entries to fill in the template.
   */
  var addEntryToList = function addEntryToList(entries) {
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
    $(cfg.selectTopEventHandler).append(output)
                                .trigger('entryAdded', [{
                                  objects: $(objectsId.join(', '))
                                }]);
  };

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
   * Give visual hints that some content is actionable through JS.
   * @param {jQuery} $objects Containers following the template for entries.
   */
  var showClickable = function showClickable($objects) {
    $objects.find(cfg.selectTitles).addClass(cfg.classClickable);
    setHeight($objects);
  }

  /**
   * Display entries stored in the local storage.
   */
  var displayLocalEntries = function displayLocalEntries() {
    addEntryToList(getEntriesFromDB());
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

  var postEntry = function postEntry() {
    var titleVal = $(cfg.selectFormTitle).val(),
        descVal  = $(cfg.selectFormDesc).val(),
        locationVal = $(cfg.selectFormLocation).val();
  
    if (!titleVal || !descVal) {
      return;
    };

    data = {
      'entryID':     cfg.counter + 1,
      'title':       titleVal,
      'description': descVal,
      'location':    locationVal
    };

    addEntryToList([data]);
    storeEntry(data);
    notifyUser('Your entry was posted successfully!');
  }

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
   * Pushes a notification to the browser that will be displayed to the user if this one allows it.
   * @param  {String} body  Describe what happened and eventually what needs to be done.
   *
   * @option {String} type  Set the type of notification: error, warning or default (success).
   * @option {String} title Set the title for the notification box (Default will be set if null).
   */
  var notifyUser = function notifyUser(body) {
    var argumentsL = arguments.length,
        icon       = "img/dialog-information.svg",
        title      = 'Over here!';

    if(2 === argumentsL) {
      switch(arguments[1]) {
        case 'error':
          icon  = "img/dialog-error.svg";
          title = 'Oopsie…';
        case 'warning':
          icon  = "img/dialog-warning.svg";
          title = 'Something’s wrong, but nothing’s broken!';
        default:
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

  // Initialize the layout and behaviors on the page.
  init();

  // Make some values public.
  return {
    listEntries: listEntries
  };
})();
