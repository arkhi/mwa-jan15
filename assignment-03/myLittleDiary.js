var myLittleDiary = (function(){
  var cfg = {
    classCanCollapse:      'can-collapse',
    classClickable:        'can-click',
    classState:            'open',

    selectTitles:          '.collapse-toggle',
    selectDescriptions:    '.collapse-toggled',
    selectTopEventHandler: '.entries',
    selectFormPostEntry:   '#post-entry',

    tplEntry:              '#tpl-entry',

    dependencies:          [
      'jQuery',
      jQuery.templates
    ]
  }

  cfg.selectContainers = '.' + cfg.classCanCollapse;

  var $containers = $(cfg.selectContainers);

  /**
   * Check that dependies are met.
   * @param  {array}   Ordered list of window properties or variables.
   * @return {string}  Message explaining which dependency is missing.
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
    });

    /**
     * Check if some entries were added dynamicaly
     * @param  {object}  data  jQuery objects to operate on.
     */
    $(cfg.selectTopEventHandler).on('entryAdded', function(event, data){
      showClickable(data.objects);
    });
  }

  /**
   * Set height fot targeted element.
   * @param {jQuery}  $container  Object representing DOM elements.
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
   * @param {object}  data  Contains the structure to fill in the template.
   *                        This object has to have an "entryId" property to know which entries were
   *                        added.
   */
  var addEntry = function addEntry(data) {
    var output    = [],
        objectsId = [];

    // Create new objects and their references based on data and templates.
    if($.isArray(data)) {
      $.each(data, function(i, entry){
        output.push(templatize(cfg.tplEntry, entry));
        objectsId.push('#' + entry.entryId);
      });
    } else {
      throw('Data is not an array.');
    }

    // Add all objects to DOM, and let event listener know we added specific entries.
    $(cfg.selectTopEventHandler).append(output)
                                .trigger('entryAdded', [{
                                  objects: $(objectsId.join(', '))
                                }]);
  };

  /**
   * [templatize description]
   * @param  {[type]} tpl   [description]
   * @param  {[type]} entry [description]
   * @return {[type]}       [description]
   */
  var templatize = function templatize(tpl, entry) {
    var $templateEntry = $.templates(tpl),
        output         = $templateEntry.render(entry);

    return output;
  };

  /**
   * Give visual hints that some content is actionable through JS.
   * @param  {jQuery}  $objects  Containers following the template for entries.
   */
  var showClickable = function showClickable($objects) {
    $objects.find(cfg.selectTitles).addClass(cfg.classClickable);
    setHeight($objects);
  }

  // Initialize the layout and behaviors on the page.
  init();

  // Make some values public.
  return {
    addEntry: addEntry
  };
})();
