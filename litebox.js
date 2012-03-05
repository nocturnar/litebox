// **Litebox** is a simple lightbox requires minimal
// markup, and is designed to be simple to use
// and configure *without* any knowledge of JavaScript.
//
// To begin using Litebox, you need jQuery, Zepto.js,
// or Ender, the litebox script, and the CSS provided with
// litebox. Most of the styling can be customizable via CSS.
(function (window, $) {


// The `layer` is the DOMElement that should be
// turned into a lightbox. Inside the `layer` is
// assumed to be a single `<img>` tag.
//
// The `pane` is the `Litebox.Pane` that will be
// shown when the `layer` is clicked.
//
// `params` is an object hash of options that provides
// information as to how to render the lightbox.
// Accepted parameters are:
//
//   - `duration`: how long it should take for
//                 the lightbox to animate.
//
//      These are all equivalent durations:
//      `".2s"`, `"200ms"`, `200`
//
//   - `scale`: the amount the image should
//              be scaled when viewed as a
//              thumbnail.
// 
//      Scales can be written as `"50%"` or `.5`.
//
//   - `layout`: a CSS layout that provides
//               clipping and sizing information
//               for a thumbnail.
//
//      Layouts can take positioning and sizing
//      parameters, and are written like inline
//      CSS `style` attributes (ie. `"left: 0px; width: 200px"`)
//
//      `left`, `right`, `bottom`, `top`, `width`, and `height`
//      are the normal CSS attributes that can
//      be used in the layout. These can have
//      units of `em`, `px`, or `%`.
//
//      In addition to these parameters, `centerX`
//      and `centerY` are available to use to
//      center an image with an offset from the
//      either the center of the x axis or y axis.
Litebox = function (layer, pane, params) {
  var $layer = $(layer),
      $img = $layer.find('img'),
      img = $img[0],
      thumbnailSize = {};

  // Lazily instantiate `Litebox.lightboxes`
  // for easy access to Lightboxes on screen
  // via a id lookup.
  if (!Litebox.lightboxes) {
    Litebox.lightboxes = {};
  }

  if (!$layer.attr('id')) {
    $layer.attr('id', 'litebox' + (uid++));
  }
  Litebox.lightboxes[$layer.attr('id')] = this;

  this.layer = layer;
  this.pane = pane;

  var duration = params.duration;
  if (duration) {
    // Check to see if the duration was written
    // in seconds (ie. "2s"), and transform it
    // into milliseconds.
    if (/^(\d|\.)+s$/.test(duration)) {
      duration = parseFloat(duration) * 1000;

    // By default, parse the duration as if it
    // were milliseconds.
    // This means that '200' and '200ms' are
    // treated the same
    } else {
      duration = parseFloat(duration);
    }

    if (!isNaN(duration)) {
      this.duration = duration;
    }
  }

  var scale = params.scale;
  if (scale) {
    // Check to see if the scale was written using
    // percentages.
    // If it was, transform it into it's float representation.
    // (ie "50%" -> .5)
    if (/^(\d)+%$/.test(scale)) {
      scale = parseInt(scale) / 100;

    // By default, parse the scale as-is
    } else {
      scale = parseFloat(scale);
    }

    if (!isNaN(scale)) {
      this.scale = scale;
    }
  }

  var layout = {},
      style = {},
      idx, attrs, len, parts;
  if (params.layout) {
    // Parse the layout so we can apply the style to the element.
    attrs = params.layout.split(';');
    len = attrs.length;
    for (idx = 0; idx < len; idx++) {
      parts = attrs[idx].split(':');
      layout[trim.call(parts[0])] = trim.call(parts[1]);
    }
  }
  this.layout = layout;
  this.fullImageStyle = {};
  this.thumbnailSize = thumbnailSize;

  // The image should be automatically resized if the
  // width and height of the image is not explicitly set.
  var resize = this.resize = !layout.width && !layout.height;

  // Apply a clipping style to the image if necessary.
  // Reverse the offsets so the clipping style refers to
  // clipping offsets on the image itself rather than the
  // clipping box.
  if (layout.left)   style.left = reverseOffset(layout.left);
  if (layout.right)  style.right = reverseOffset(layout.right);
  if (layout.top)    style.top = reverseOffset(layout.top);
  if (layout.bottom) style.bottom = reverseOffset(layout.bottom);

  for (var k in style) {
    if (style.hasOwnProperty(k)) {
      this.fullImageStyle[k] = 0;
    }
  }

  this.thumbnailImageStyle = style;
  $img.css(style);

  var imageSize,
      self = this;

  // If the image has finished loading, then
  // just get the size
  if (img.complete) {
    if (layout.width)  thumbnailSize.width  = parseInt(layout.width, 10);
    if (layout.height) thumbnailSize.height = parseInt(layout.height, 10);

    this.imageSize = sizeLightbox(this, $img);
    $layer.css(this.thumbnailSize);

    $layer.bind('click', function () {
      self.show.apply(self, arguments);
    });

  // Otherwise, we need to wait until the image
  // emits an `onload` event.
  } else {
    img.onload = function () {
      self.imageSize = sizeLightbox(self, $img);
      $popup.find('img').css({
        width: (self.imageSize.width * self.scale) + 'px',
        height: (self.imageSize.height * self.scale) + 'px'
      });
      $layer.css(self.thumbnailSize);
      $layer.bind('click', function () {
        self.show.apply(self, arguments);
      });
    };
  }

  // If the layer supports key events (it's an anchor tag,
  // for instance), then we'd like to show the lightbox
  // when the `return` key is pressed.
  $layer.keydown(function (evt) {
    if (evt.which === 13) {
      self.show();
    }
    return true;
  });

  var $popup = $layer.clone();
  this.popupLayer = $popup[0];
};

// Reverses the CSS rule from positive to negative and vice versa.
function reverseOffset(rule) {
  return (rule.charAt(0) === '-')
         ? rule.slice(1)
         : '-' + rule;
}

// Size the lightbox according to the image provided
// and options set on the lightbox.
//
// This function assumes that the image has finished loading.
function sizeLightbox(lightbox, $img) {
  var imageSize,
      img = $img[0],
      scale = lightbox.scale,
      style,
      resetStyle;

  // Get the image's actual size
  imageSize = {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height
  };

  // If the lightbox should scale to the image inside it,
  // we should set the `thumbnailSize` to be proportional
  // to the image scaled according to the `scale` property.
  if (lightbox.resize) {
    lightbox.thumbnailSize = {
      width: Math.floor(imageSize.width * scale),
      height: Math.floor(imageSize.height * scale)
    };
  }

  style = {
    width: (imageSize.width * scale) + 'px',
    height: (imageSize.height * scale) + 'px'
  };

  resetStyle = {
    width: imageSize.width + 'px',
    height: imageSize.height + 'px'
  };

  // Center the lightbox image
  if (lightbox.layout.centerX) {
    style.left = (Math.floor(imageSize.width / 2 -
                             lightbox.thumbnailSize.width / 2) * -1) +
                 (parseInt(lightbox.layout.centerX, 10) * -1) + 'px';

    resetStyle.left = 0;
  }

  if (lightbox.layout.centerY && lightbox.layout.height) {
    style.top = (Math.floor(imageSize.height / 2 -
                             lightbox.thumbnailSize.height / 2) * -1) +
                 (parseInt(lightbox.layout.centerY, 10) * -1) + 'px';

    resetStyle.top = 0;
  }

  // Adjust the precomputed image styles to adjust
  // for image scaling.
  mix(style).into(lightbox.thumbnailImageStyle);
  mix(resetStyle).into(lightbox.fullImageStyle);

  $img.css(style);

  return imageSize;
}

Litebox.prototype = {

  // How long it should take the lightbox to
  // animate (in milliseconds)
  duration: 500,

  // The scale of the image when it's a thumbnail.
  // 1 means 100% scale.
  scale: 1,

  // The layout provided by the user.
  layout: null,

  // Whether the image should be resized to fit
  // the contents of the lightbox.
  resize: true,

  // A CSS style hash that provides clipping offsets
  // and sizing for the thumbnail version of the
  // lightbox image.
  thumbnailImageStyle: null,

  // A CSS style hash that provides reset values
  // to the `thumbnailImageStyle` so the image
  // animates smoothly.
  fullImageStyle: null,

  // The size of the lightbox as a thumbnail.
  thumbnailSize: null,

  // The full size of the image.
  imageSize: null,

  // The `DOMElement` that has had lightbox properties
  // attached to it.
  layer: null,

  // The `DOMElement` that will appear after clicking
  // the lightbox thumbnail.
  popupLayer: null,

  // A `Boolean` indicating whether the lightbox is animating.
  isAnimating: false,

  // A `Boolean` indicating whether lightbox is currently showing.
  isShowing: false,

  // Shows the lightbox by animating the image into
  // the center of the screen with an overlay behind it.
  //
  // Clicking anywhere on the page will dismiss the popup.
  show: function () {
    if (this.isShowing) return;
    this.isShowing = true;

    var $lightbox = $(this.layer),
        $window = $(window),
        $popup = $(this.popupLayer),
        $pane = $(this.pane.layer),
        targetStyle,
        thumbnailStyle,
        screen = { height: window.innerHeight
                           ? window.innerHeight
                           : $window.height(),
                   width: window.innerWidth
                          ? window.innerWidth
                          : $window.width() };

    // Calculated the target layout and home layout
    // lazily when asked to show the lightbox for the first time,
    // then cache it for use later.
    var offset = $lightbox.offset();
    thumbnailStyle = mix(this.thumbnailSize, {
      top: Math.floor(offset.top) - $window.scrollTop(),
      left: Math.floor(offset.left) - $window.scrollLeft()
    }).into({
      marginTop: '0px',
      marginLeft: '0px'
    });

    // Calculate the center of the screen in pixels
    targetStyle = mix(this.imageSize).into({
      top: Math.floor(screen.height / 2) + "px",
      left: Math.floor(screen.width / 2) + "px",
      marginTop: (-1 * Math.floor(this.imageSize.height / 2)) + "px",
      marginLeft: (-1 * Math.floor(this.imageSize.width / 2)) + "px"
    });

    $popup.css(thumbnailStyle);
    $pane.append($popup);

    // Bind events to close the popup when the user clicks anywhere
    // on the screen.
    var self = this;
    $pane.find('.litebox-modal-pane').bind('click', function () {
      self.hide.apply(self, arguments);
    });
    $popup.bind('click', function () {
      self.hide.apply(self, arguments);
    });

    this.pane.show(this.duration);

    // Allow the `escape` key to dismiss the pane.
    $window.keydown(self, this.keyDown);
    $popup.find('img').animate(this.fullImageStyle, this.duration);
    self.isAnimating = true;

    $popup.animate(targetStyle, this.duration, function () {
      self.isAnimating = false;
      $popup.addClass('active');
      $popup.css({
        top: '50%',
        left: '50%'
      });
    });
  },

  // Called when any keys are pressed when the lightbox is visible.
  keyDown: function (evt) {
    if (evt.which === 27) {
      evt.data.hide();
    }
  },

  // Hides the popup pane by animating the image back to the
  // where the thumbnail is in the DOM.
  hide: function () {
    if (!this.isShowing) return;

    var $popup = $(this.popupLayer),
        $lightbox = $(this.layer),
        $pane = $(this.pane.layer),
        $window = $(window),
        thumbnailStyle,
        screen = { height: window.innerHeight
                           ? window.innerHeight
                           : $window.height(),
                   width: window.innerWidth
                          ? window.innerWidth
                          : $window.width() },
        self = this;

    // Center the image so the animation is smooth.
    var offset = $lightbox.offset();
    thumbnailStyle = mix(this.thumbnailSize, {
      top: Math.floor(offset.top) - $window.scrollTop(),
      left: Math.floor(offset.left) - $window.scrollLeft()
    }).into({
      marginTop: '0px',
      marginLeft: '0px'
    });

    this.pane.hide(this.duration);

    $popup.removeClass('active');
    if (!this.isAnimating) {
      $popup.css({
        left: Math.floor(screen.width / 2) + "px",
        top: Math.floor(screen.height / 2) + "px"
      });
    } else {
      $popup.stop();
      $popup.find('img').stop();
    }

    $popup.find('img').animate(this.thumbnailImageStyle, this.duration);
    $window.unbind('keydown', this.keyDown);

    $popup.animate(thumbnailStyle, this.duration, function () {
      self.isShowing = false;
      $popup.remove();
      $popup.unbind('click');
      $pane.find('.litebox-modal-pane').unbind('click');
    });
  }
};

// A pane that holds any popup clones and will be the
// first to recieve mouse events.
Litebox.Pane = function (parent) {
  var paneID = 'pane-' + (uid++),
      $pane, $modal;

  $(parent).append('<div class="litebox-pane" id="' + paneID + '">' +
                        '<div class="litebox-modal-pane"></div>' +
                        '</div>');
  $pane = $('#' + paneID);
  $modal = $pane.children();
  $pane.hide();
  this._opacity = $modal.css('opacity');
  this.layer = $pane[0];
};

Litebox.Pane.prototype = {

  // A `Boolean` indicating whether the pane
  // is currently animating
  isAnimating: false,

  // Hides the pane taking `duration` milliseconds to do so
  hide: function (duration) {
    var layer = this.layer,
        $pane = $(layer),
        $modal = $pane.find('.litebox-modal-pane');

    if (this.isAnimating) {
      $modal.stop();
    }

    $modal.animate({
      opacity: 0
    }, duration, function () {
      $pane.hide();
    });
  },

  // Shows the pane taking `duration` milliseconds to do so
  show: function (duration) {
    var layer = this.layer,
        $pane = $(layer),
        $modal = $pane.find('.litebox-modal-pane'),
        self = this;

    self.isAnimating = true;
    $pane.show();
    $modal.css('opacity', 0);
    $modal.animate({
      opacity: this._opacity
    }, duration, function () {
      self.isAnimating = false;
    });
  }
};

// Unique identifier for lightbox elements
var uid = 0;

// Trim a string's leading and trailing
// whitespace.
//
//     trim.call(' Personal space   ');
//     // -> 'Personal space'
var trim = String.prototype.trim || function () {
  var s = this.match(/\S+(?:\s+\S+)*/);
  return s ? s[0] : '';
};

// Internal function to mix the arguments
// passed in into the target object.
//
// For example:
//
//     var o = {};
//     mix({
//       foo: 'bar'
//     }).into(o);
//
//     assert(o.foo === 'bar');
//
var mix = function () {
  var mixins = arguments,
      i = 0, len = mixins.length;

  return {
    into: function (target) {
      var mixin, key;
      for (; i < len; i += 1) {
        mixin = mixins[i];
        for (key in mixin) {
          target[key] = mixin[key];
        }
      }
      return target;
    }
  };
};

// When the document is ready, look for every
// element with the class `litebox`, extract
// parameters written as `data-` attributes and
// create a new lightbox.
$(document).ready(function () {
  var pane = new Litebox.Pane($('body')[0]);

  $('.litebox').each(function (idx, lightbox) {
    new Litebox(lightbox, pane, $(lightbox).data());
  });
});

window.Litebox = Litebox;

}(this, $ || jQuery));
