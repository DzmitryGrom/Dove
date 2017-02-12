/** Тут общий JS для всех файлов **/
/*global $*/
$(document).ready(function () {
    'use strict';
    
    $(".navbar-toggle").on("click", function() {
        $(".navbar-collapse").removeClass(".collapsing")
        setTimeout(function(){ 
            $(".navbar-collapse ").toggleClass("open");
        }, 400);
    })
    
});

