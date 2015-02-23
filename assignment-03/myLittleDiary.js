var myLittleDiary = (function(){
  var $articles = $('article');

  var setHeight = function setHeight($article) {
    var headerH  = $article.find('h2').outerHeight(true),
        contentH = $article.find('p').outerHeight(true);

    if($article.hasClass('open')) {
      $article.height(headerH + contentH + 'px');
    } else {
      $article.height(headerH + 'px');
    }
  };

  var init = function init(){
    /**
     * Reset heights when the window is resized or the orientation changes.
     */
    $(window).on('resize', function(){
      $articles.each(function(){
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
      $articles.each(function(){
        $(this).addClass('can-open')
               .find('h2').addClass('can-click');
        setHeight($(this));
      });

      $('.entries').on('click', 'h2', function(){
        var $article = $(this).closest('article');
        $article.toggleClass('open');
        setHeight($article);
      });
    });
  }

  /**
   * Make some values public.
   */
  return {
    init: init
  };
})();
