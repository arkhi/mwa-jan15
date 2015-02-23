var myLittleDiary = (function(){
  var cfg = {
    classCanCollapse:      'can-collapse',
    classClickable:        'can-click',
    classState:            'open',

    selectTitles:          '.collapse-toggle',
    selectDescriptions:    '.collapse-toggled',
    selectTopEventHandler: '.entries',
    selectFormAddEntry:    '#add-entry'
  }

  cfg.selectContainers = '.' + cfg.classCanCollapse;

  var $containers = $(cfg.selectContainers);

  /**
   * Launch basic setup for the application.
   */
  var init = function init(){
    /**
     * Reset heights when the window is resized or the orientation changes.
     */
    $(window).on('resize', function(){
      $containers.each(function(){
        setHeight($(this));
      });
    });

    /**
     * Collapse all contents.
     * Show the user they can click on titles.
     * Set default heights.
     * Toggle classes and compute heights on click.
     */
    $(document).ready(function(){
      $containers.each(function(){
        $(this).find(cfg.selectTitles).addClass(cfg.classClickable);
        setHeight($(this));
      });

      $(cfg.selectTopEventHandler).on('click', cfg.selectTitles, function(){
        var $article = $(this).closest(cfg.selectContainers);
        $article.toggleClass(cfg.classState);
        setHeight($article);
      });
    });
  }

  /**
   * set height fot targeted element.
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
   * Make some values public.
   */
  return {
    init: init
  };
})();
