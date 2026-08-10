(function () {
  function toArray(selector) {
    if (!selector) return [];
    if (typeof selector === "string") return Array.prototype.slice.call(document.querySelectorAll(selector));
    if (selector.nodeType === 1) return [selector];
    if (Array.isArray(selector)) return selector;
    return [];
  }

  function clone(vars) {
    var out = {};
    Object.keys(vars || {}).forEach(function (key) {
      if (key !== "duration" && key !== "ease" && key !== "stagger" && key !== "repeat" && key !== "transformOrigin") {
        out[key] = vars[key];
      }
    });
    return out;
  }

  function parseTime(position) {
    if (typeof position === "number") return position;
    if (typeof position === "string") return Number(position) || 0;
    return 0;
  }

  function defaultValue(prop, el) {
    if (prop === "opacity") return Number(getComputedStyle(el).opacity || 1);
    if (prop === "scale" || prop === "scaleX") return 1;
    return 0;
  }

  function valueAt(prop, vars, el) {
    if (!vars || vars[prop] === undefined) return defaultValue(prop, el);
    return Number(vars[prop]);
  }

  function addProps(target, vars) {
    Object.keys(vars || {}).forEach(function (prop) {
      target[prop] = vars[prop];
    });
  }

  function applyState(el, state) {
    if (state.opacity !== undefined) el.style.opacity = String(state.opacity);
    var x = state.x || 0;
    var y = state.y || 0;
    var scale = state.scale === undefined ? 1 : state.scale;
    var scaleX = state.scaleX === undefined ? 1 : state.scaleX;
    el.style.transform = "translate(" + x + "px, " + y + "px) scale(" + scaleX + ", " + scale + ")";
    if (state.color !== undefined) el.style.color = state.color;
    if (state.backgroundColor !== undefined) el.style.backgroundColor = state.backgroundColor;
    if (state.borderRadius !== undefined) el.style.borderRadius = state.borderRadius;
  }

  function makeTimeline() {
    var entries = [];
    var controlled = new Set();
    var bases = new Map();
    var currentTime = 0;
    var playbackRate = 1;
    var paused = true;

    function remember(elements) {
      elements.forEach(function (el) {
        controlled.add(el);
        if (!bases.has(el)) {
          bases.set(el, {
            opacity: Number(getComputedStyle(el).opacity || 1),
            x: 0,
            y: 0,
            scale: 1,
            scaleX: 1
          });
        }
      });
    }

    function add(type, selector, varsA, varsB, position) {
      var elements = toArray(selector);
      remember(elements);
      entries.push({
        type: type,
        elements: elements,
        start: parseTime(position),
        duration: Number((varsB || varsA || {}).duration || 0),
        repeat: Number((varsB || varsA || {}).repeat || 0),
        from: clone(type === "fromTo" ? varsA : varsA),
        to: clone(type === "fromTo" ? varsB : varsA)
      });
      return api;
    }

    function applyTween(entry, time, states) {
      var total = entry.duration * (entry.repeat + 1 || 1);
      entry.elements.forEach(function (el) {
        var state = states.get(el) || Object.assign({}, bases.get(el));
        states.set(el, state);
        if (entry.type === "set") {
          if (time >= entry.start) addProps(state, entry.to);
          return;
        }
        var elapsed = time - entry.start;
        if (elapsed < 0) {
          if (entry.type === "from" || entry.type === "fromTo") addProps(state, entry.from);
          return;
        }
        if (entry.duration <= 0) {
          addProps(state, entry.to);
          return;
        }
        if (elapsed > total) {
          if (entry.type === "from") {
            Object.keys(entry.from).forEach(function (prop) {
              state[prop] = defaultValue(prop, el);
            });
          } else {
            addProps(state, entry.to);
          }
          return;
        }
        var cycleElapsed = entry.duration ? elapsed % entry.duration : elapsed;
        if (elapsed === total) cycleElapsed = entry.duration;
        var p = Math.max(0, Math.min(1, cycleElapsed / entry.duration));
        var props = {};
        if (entry.type === "from") {
          Object.keys(entry.from).forEach(function (prop) {
            var a = valueAt(prop, entry.from, el);
            var b = defaultValue(prop, el);
            props[prop] = a + (b - a) * p;
          });
        } else {
          var fromVars = entry.type === "fromTo" ? entry.from : {};
          Object.keys(entry.to).forEach(function (prop) {
            var a2 = valueAt(prop, fromVars, el);
            var b2 = valueAt(prop, entry.to, el);
            props[prop] = a2 + (b2 - a2) * p;
          });
        }
        addProps(state, props);
      });
    }

    function timelineDuration() {
      var max = 0;
      entries.forEach(function (entry) {
        var total = entry.duration * (entry.repeat + 1 || 1);
        max = Math.max(max, entry.start + total);
      });
      return max;
    }

    var api = {
      from: function (selector, vars, position) {
        return add("from", selector, vars, null, position);
      },
      to: function (selector, vars, position) {
        return add("to", selector, vars, null, position);
      },
      fromTo: function (selector, fromVars, toVars, position) {
        return add("fromTo", selector, fromVars, toVars, position);
      },
      set: function (selector, vars, position) {
        return add("set", selector, vars, null, position);
      },
      seek: function (time) {
        currentTime = Math.max(0, Number(time) || 0);
        var states = new Map();
        controlled.forEach(function (el) {
          states.set(el, Object.assign({}, bases.get(el)));
        });
        entries
          .slice()
          .sort(function (a, b) { return a.start - b.start; })
          .forEach(function (entry) { applyTween(entry, currentTime, states); });
        states.forEach(function (state, el) { applyState(el, state); });
        return api;
      },
      totalTime: function (time) {
        if (arguments.length > 0) return api.seek(time);
        return currentTime;
      },
      time: function (time) {
        if (arguments.length > 0) return api.seek(time);
        return currentTime;
      },
      duration: function () {
        return timelineDuration();
      },
      totalDuration: function () {
        return timelineDuration();
      },
      timeScale: function (value) {
        if (arguments.length > 0) {
          playbackRate = Number(value) || 1;
          return api;
        }
        return playbackRate;
      },
      paused: function (value) {
        if (arguments.length > 0) {
          paused = Boolean(value);
          return api;
        }
        return paused;
      },
      pause: function () {
        paused = true;
        return api;
      },
      play: function () {
        paused = false;
        return api;
      },
      getChildren: function () {
        return [];
      },
      kill: function () {
        return api;
      }
    };
    return api;
  }

  window.gsap = {
    timeline: function () { return makeTimeline(); }
  };
})();
