import { glob } from './Global';
import { BaseLayer } from './BaseLayer';
import { Stage } from './Stage';
import { Layer } from './Layer';

var now = (function() {
  if (glob.performance && glob.performance.now) {
    return function() {
      return glob.performance.now();
    };
  }

  return function() {
    return new Date().getTime();
  };
})();

function FRAF(callback) {
  setTimeout(callback, 1000 / 60);
}

var RAF = (function() {
  return (
    glob.requestAnimationFrame ||
    glob.webkitRequestAnimationFrame ||
    glob.mozRequestAnimationFrame ||
    glob.oRequestAnimationFrame ||
    glob.msRequestAnimationFrame ||
    FRAF
  );
})();

function requestAnimFrame(func) {
  return RAF.call(glob, func);
}

/**
 * Animation constructor.  A stage is used to contain multiple layers and handle
 * @constructor
 * @memberof Konva
 * @param {Function} func function executed on each animation frame.  The function is passed a frame object, which contains
 *  timeDiff, lastTime, time, and frameRate properties.  The timeDiff property is the number of milliseconds that have passed
 *  since the last animation frame.  The lastTime property is time in milliseconds that elapsed from the moment the animation started
 *  to the last animation frame.  The time property is the time in milliseconds that ellapsed from the moment the animation started
 *  to the current animation frame.  The frameRate property is the current frame rate in frames / second. Return false from function,
 *  if you don't need to redraw layer/layers on some frames.
 * @param {Konva.Layer|Array} [layers] layer(s) to be redrawn on each animation frame. Can be a layer, an array of layers, or null.
 *  Not specifying a node will result in no redraw.
 * @example
 * // move a node to the right at 50 pixels / second
 * var velocity = 50;
 *
 * var anim = new Konva.Animation(function(frame) {
 *   var dist = velocity * (frame.timeDiff / 1000);
 *   node.move(dist, 0);
 * }, layer);
 *
 * anim.start();
 */
export class Animation {
  func: () => boolean;
  id = Animation.animIdCounter++;

  layers: Layer[];

  frame = {
    time: 0,
    timeDiff: 0,
    lastTime: now(),
    frameRate: 0
  };

  constructor(func, layers?) {
    this.func = func;
    this.setLayers(layers);
  }
  /**
   * set layers to be redrawn on each animation frame
   * @method
   * @name Konva.Animation#setLayers
   * @param {Konva.Layer|Array} [layers] layer(s) to be redrawn. Can be a layer, an array of layers, or null.  Not specifying a node will result in no redraw.
   * @return {Konva.Animation} this
   */
  setLayers(layers) {
    var lays = [];
    // if passing in no layers
    if (!layers) {
      lays = [];
    } else if (layers.length > 0) {
      // if passing in an array of Layers
      // NOTE: layers could be an array or Konva.Collection.  for simplicity, I'm just inspecting
      // the length property to check for both cases
      lays = layers;
    } else {
      // if passing in a Layer
      lays = [layers];
    }

    this.layers = lays;
    return this;
  }
  /**
   * get layers
   * @method
   * @name Konva.Animation#getLayers
   * @return {Array} Array of Konva.Layer
   */
  getLayers() {
    return this.layers;
  }
  /**
   * add layer.  Returns true if the layer was added, and false if it was not
   * @method
   * @name Konva.Animation#addLayer
   * @param {Konva.Layer} layer to add
   * @return {Bool} true if layer is added to animation, otherwise false
   */
  addLayer(layer) {
    var layers = this.layers,
      len = layers.length,
      n;

    // don't add the layer if it already exists
    for (n = 0; n < len; n++) {
      if (layers[n]._id === layer._id) {
        return false;
      }
    }

    this.layers.push(layer);
    return true;
  }
  /**
   * determine if animation is running or not.  returns true or false
   * @method
   * @name Konva.Animation#isRunning
   * @return {Bool} is animation running?
   */
  isRunning() {
    var a = Animation,
      animations = a.animations,
      len = animations.length,
      n;

    for (n = 0; n < len; n++) {
      if (animations[n].id === this.id) {
        return true;
      }
    }
    return false;
  }
  /**
   * start animation
   * @method
   * @name Konva.Animation#start
   * @return {Konva.Animation} this
   */
  start() {
    this.stop();
    this.frame.timeDiff = 0;
    this.frame.lastTime = now();
    Animation._addAnimation(this);
    return this;
  }
  /**
   * stop animation
   * @method
   * @name Konva.Animation#stop
   * @return {Konva.Animation} this
   */
  stop() {
    Animation._removeAnimation(this);
    return this;
  }
  _updateFrameObject(time) {
    this.frame.timeDiff = time - this.frame.lastTime;
    this.frame.lastTime = time;
    this.frame.time += this.frame.timeDiff;
    this.frame.frameRate = 1000 / this.frame.timeDiff;
  }

  static animations = [];
  static animIdCounter = 0;
  static animRunning = false;

  static _addAnimation(anim) {
    this.animations.push(anim);
    this._handleAnimation();
  }
  static _removeAnimation(anim) {
    var id = anim.id,
      animations = this.animations,
      len = animations.length,
      n;

    for (n = 0; n < len; n++) {
      if (animations[n].id === id) {
        this.animations.splice(n, 1);
        break;
      }
    }
  }

  static _runFrames() {
    var layerHash = {},
      animations = this.animations,
      anim,
      layers,
      func,
      n,
      i,
      layersLen,
      layer,
      key,
      needRedraw;
    /*
     * loop through all animations and execute animation
     *  function.  if the animation object has specified node,
     *  we can add the node to the nodes hash to eliminate
     *  drawing the same node multiple times.  The node property
     *  can be the stage itself or a layer
     */
    /*
     * WARNING: don't cache animations.length because it could change while
     * the for loop is running, causing a JS error
     */

    for (n = 0; n < animations.length; n++) {
      anim = animations[n];
      layers = anim.layers;
      func = anim.func;

      anim._updateFrameObject(now());
      layersLen = layers.length;

      // if animation object has a function, execute it
      if (func) {
        // allow anim bypassing drawing
        needRedraw = func.call(anim, anim.frame) !== false;
      } else {
        needRedraw = true;
      }
      if (!needRedraw) {
        continue;
      }
      for (i = 0; i < layersLen; i++) {
        layer = layers[i];

        if (layer._id !== undefined) {
          layerHash[layer._id] = layer;
        }
      }
    }

    for (key in layerHash) {
      if (!layerHash.hasOwnProperty(key)) {
        continue;
      }
      layerHash[key].draw();
    }
  }
  static _animationLoop() {
    var Anim = Animation;
    if (Anim.animations.length) {
      Anim._runFrames();
      requestAnimFrame(Anim._animationLoop);
    } else {
      Anim.animRunning = false;
    }
  }
  static _handleAnimation() {
    if (!this.animRunning) {
      this.animRunning = true;
      requestAnimFrame(this._animationLoop);
    }
  }
}

/**
 * batch draw. this function will not do immediate draw
 * but it will schedule drawing to next tick (requestAnimFrame)
 * @method
 * @name Konva.BaseLayer#batchDraw
 * @return {Konva.Layer} this
 */
// TODO: don't use animation or make sure they all run at the same time
BaseLayer.prototype.batchDraw = function() {
  var that = this,
    Anim = Animation;

  if (!this.batchAnim) {
    this.batchAnim = new Anim(function() {
      // stop animation after first tick
      that.batchAnim.stop();
    }, this);
  }

  if (!this.batchAnim.isRunning()) {
    this.batchAnim.start();
  }
  return this;
};

/**
 * batch draw
 * @method
 * @name Konva.BaseLayer#batchDraw
 * @return {Konva.Stage} this
 */
Stage.prototype.batchDraw = function() {
  this.getChildren().each(function(layer) {
    layer.batchDraw();
  });
  return this;
};
