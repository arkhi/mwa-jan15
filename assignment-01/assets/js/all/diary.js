(function (exports, $) {
    // Display an error message and stop the script if localStorage is not available.
    if ('undefined' === typeof(localStorage)) {
        $("#posts").append($("<div class='notification error.'>Sorry! This application won’t " +
                             "work because your browser doesn’t support localStorage. :|</div>"));
        $('#add-entry').remove();
        return exports;
    }

    function showEntries () {
        var data = localStorage.getItem("data");
        if (!data) {
            data = [
                "<h3>Welcome to My Diary!!!!</h3>" +
                "<div class='date'></div>" +
                "<p>There are currently no entries in this diary, but go ahead and add one — it" +
                " will be AWESOME!!!</p>"
            ];
        } else {
          data = JSON.parse(data);
        }
        var $posts = $("#posts");
        $posts.empty();
        $.each(data, function (i, post) {
            $posts.append($("<div class='post'></div>").append($(post)));
        });
    }

    function addEntry (subject, body) {
        var data = localStorage.getItem("data");
        if (data) data = JSON.parse(data);
        else data = [];
        body = body.replace(/\n/g, "<br/>");
        var $cont = $("<div></div>");
        $("<h3></h3>").text(subject).appendTo($cont);
        $("<div class='date'></div>").text((new Date).toLocaleString()).appendTo($cont);
        $("<p></p>").html(body).appendTo($cont);
        data.unshift($cont.html());
        localStorage.setItem("data", JSON.stringify(data));
    }

    exports.addTxt = function () {
        $("#add-text").removeClass('is-hidden').find("input").focus();
    };

    exports.okEdit = function () {
        var subject = $("#add-text input").val();
        if (!subject) {
            alert("Subject is required");
            return;
        }
        var body = $("#add-text textarea").val();
        if (!body) {
            alert("Body is required");
            return;
        }
        addEntry(subject, body);
        exports.cancelEdit();
        showEntries();
    };

    exports.cancelEdit = function () {
        $("#add-text input").val("");
        $("#add-text textarea").val("");
        $("#add-text").addClass('is-hidden');
    };

    /**
     * Since China is blocking anything related to Google, avoid blocking the loading process if
     * the user doesn’t have a VPN. Lazyload.css is here to avoid cross-domain problems; its content
     * is http://fonts.googleapis.com/css?family=Over+the+Rainbow%7CLobster%7CBangers%7CJulee.
     *
     * TODO: Update with location based detection and an object with country:[domains]?
     * TODO: Check http://www.w3.org/TR/html5/document-metadata.html#attr-link-crossorigin and
     *       http://blogs.telerik.com/kendoui/posts/11-10-03/using_cors_with_all_modern_browsers.
     */
    exports.loadFonts = function () {
        var lazyLoad = {
            url: 'css/lazyload.min.css',
            media: 'all and (min-width:40em)'
        };
        if (document.createStyleSheet) {
            document.createStyleSheet(lazyLoad.url).setAttribute('media', lazyLoad.media);
        } else {
            $('<link/>', {
                rel:   'stylesheet',
                href:  lazyLoad.url,
                media: lazyLoad.media,
            }).insertBefore('#loadLast');
        }
    }

    /**
     * If the browser can use JS, show interface.
     */
    function hasJS () {
        $("#sidebar").removeClass('is-hidden');
    }

    $(hasJS);
    $(loadFonts);
    $(showEntries);
})(window, jQuery);
