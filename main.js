const myCanvas = document.getElementById("myCanvas");

function resizeCanvas() {
  myCanvas.width = window.innerWidth;
  myCanvas.height = window.innerHeight;
}
resizeCanvas(); // 初始設定
window.addEventListener("resize", resizeCanvas);

const ctx = myCanvas.getContext("2d");
// 直接每次都讀取 saves/yuntech.world
fetch('saves/yuntech.world')
  .then(response => response.text())
  .then(text => {
    const worldInfo = JSON.parse(text);
    startMain(worldInfo);
  })
  .catch(err => {
    alert("載入地圖失敗: " + err);
  });

function startMain(worldInfo) {
  window.world = World.load(worldInfo);
  window.graph = world.graph;

  const viewport = new Viewport(myCanvas, 3, world.offset);
  const graphEditor = new GraphEditor(viewport, graph);

  window.roadBorders;
  if (graphEditor.start && graphEditor.end) {
    world.generateCorridor(graphEditor.start, graphEditor.end);
    roadBorders = world.corridor.map((s) => [s.p1, s.p2]);
  } else {
    roadBorders = world.roadBorders.map((s) => [s.p1, s.p2]);
  }

  // 讀取車輛位置資料
  const carPosString = localStorage.getItem("carPos");
  const carPos = carPosString ? JSON.parse(carPosString) : null;
  let traffic = [];

  // 產生車輛
  const N = 1;
  const cars = generateCars(N);
  window.myCar = cars[0];

  viewport.offset.x = -myCar.x;
  viewport.offset.y = -myCar.y;
  
  for (let i = 1; i < cars.length; i++) {
    PDNet.mutate(cars[i].brain, 0);
  }

  const target = new Point(14454.6, 11513.9);  // 你想設定的目標座標
  for (let i = 0; i < cars.length; i++) {
    cars[i].setEndPoint(target);
  }

  function generateCars(N) {
    const cars = [];
    const bestBrainString = localStorage.getItem("bestBrain");
    const bestBrain = bestBrainString ? JSON.parse(bestBrainString) : null;
    console.log("bestBrain 載入狀態:", bestBrain ? "✅ 有載入" : "❌ 沒有載入");

    for (let i = 1; i <= N; i++) {
      const car = new Car(13167.899999999987, 10304.399999999992, 35, 45, "AI", 190 * Math.PI / 180);
      if (carPos) {
        car.setPos(carPos);
      }
      car.acceleration = 0;
      if (bestBrain) {
        car.brain = PDNet.clone(bestBrain);
        if (i === 1) {
          PDNet.mutate(car.brain, 0);
        } else {
          PDNet.mutate(car.brain, 0);
        }
      }
      cars.push(car);
    }
    return cars;
  }

  let oldGraphHash = graph.hash();


  viewport.setFollowTarget(myCar);

  function animate() {  
    // 🚗 根據速度啟用或取消自動跟隨
    if (myCar.speed > 0.5) {
        viewport.setFollowTarget(myCar);
    } else {
        viewport.setFollowTarget(null); // 速度太低，自動取消跟隨，讓手勢拖動生效
    }
    // 📍更新偏移並重設畫布
    viewport.updateFollowOffset();
    viewport.reset();

    // 🌐 若圖結構變化，重新生成世界
    if (graph.hash() !== oldGraphHash) {
        world.generate();
        oldGraphHash = graph.hash();
    }
    // 🧭 計算畫面偏移點，開始繪製
    const viewPoint = scale(viewport.getOffset(), -1);
    world.draw(ctx, viewPoint);

    ctx.globalAlpha = 0.3;
    graphEditor.display();

    // 🚘 更新並繪製車子
    myCar.update(roadBorders, traffic);
    myCar.draw(ctx);

    for (let i = 1; i < cars.length; i++) {
        cars[i].update(roadBorders, traffic);
        cars[i].draw(ctx);
    }

    requestAnimationFrame(animate);
}
animate();

  // 初始化時從 localStorage 載入最佳車輛的 brain
  function initialize() {
    const savedBrain = localStorage.getItem("bestBrain");
    if (savedBrain) {
      console.log("從 localStorage 載入 bestBrain 片段:", savedBrain.slice(0, 100));
      try {
        cars[0].brain = JSON.parse(savedBrain); // 將 brain 應用到第一輛車
        console.log("已成功載入儲存的 bestBrain 到 cars[0]");
      } catch (error) {
        console.error("載入 bestBrain 時發生錯誤:", error);
      }
    } else {
      console.log("localStorage 中沒有儲存的 bestBrain 資料");
    }
  }

  function store() {
    let bestCar = cars[0];
    console.log(`car 0 distance: ${bestCar.getDistanceToTarget()}`);
    for (let i = 1; i < cars.length; i++) {
      console.log(`car ${i} distance: ${cars[i].getDistanceToTarget()}`);
      if (cars[i].getDistanceToTarget() < bestCar.getDistanceToTarget()) {
        bestCar = cars[i];
      }
    }
    console.log("儲存最佳車距離：", bestCar.getDistanceToTarget());
    console.log("儲存前 bestBrain 片段:", JSON.stringify(bestCar.brain).slice(0, 500));
    localStorage.setItem("bestBrain", JSON.stringify(bestCar.brain));
    console.log("儲存後 localStorage bestBrain 片段:", localStorage.getItem("bestBrain").slice(0, 500));
    console.log("已儲存最佳車的 PDNet 參數");
  }

  function cancel() {
    localStorage.removeItem("bestBrain");
    console.log("🧹 已刪除儲存的 PDNet 參數");
  }

  initialize();

  function dispose() {
    graphEditor.dispose();
    world.corridor.length = 0;
    world.buildings.length = 0;
    world.trees.length = 0;
    world.waters.length = 0;
    world.markings.length = 0;
    world.grass.length = 0;
    world.pitch.length = 0;
    world.park.length = 0;
    world.court.length = 0;
    cars.length = 0;
    myCar = null;
  }

  function save() {
    world.zoom = viewport.zoom;
    world.offset = viewport.offset;

    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:application/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(world))
    );

    const fileName = "name.world";
    element.setAttribute("download", fileName);

    element.click();

    localStorage.setItem("world", JSON.stringify(world));
    const carPos = myCar.getPos();
    localStorage.setItem("carPos", JSON.stringify(carPos));
  }

  function load(event) {
    const file = event.target.files[0];
    if (!file) {
      alert("No file selected.");
      return;
    }
    const reader = new FileReader();
    reader.readAsText(file);

    reader.onload = (evt) => {
      const fileContent = evt.target.result;
      const jsonData = JSON.parse(fileContent);
      world = World.load(jsonData);
      graphEditor.graph = world.graph;
      viewport.zoom = world.zoom;
      viewport.offset = world.offset;
      animate();
    }
  }

  // function polysIntersect(poly1, poly2) {
  //   for (let i = 0; i < poly1.length; i++) {
  //     for (let j = 0; j < poly2.length; j++) {
  //       const touch = segmentsIntersect(
  //         poly1[i],
  //         poly1[(i + 1) % poly1.length],
  //         poly2[j],
  //         poly2[(j + 1) % poly2.length]
  //       );
  //       if (touch) {
  //         return true;
  //       }
  //     }
  //   }
  //   return false;
  // }

  // function segmentsIntersect(p1, p2, q1, q2) {
  //   function ccw(a, b, c) {
  //     return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  //   }
  //   return (
  //     ccw(p1, q1, q2) !== ccw(p2, q1, q2) &&
  //     ccw(p1, p2, q1) !== ccw(p1, p2, q2)
  //   );
  // }

  function setMode(mode) {
    graphEditor.setMode(mode);
    if (mode === "target") {
      document.getElementById("targetBtn").style.backgroundColor = "red";
    } else {
      document.getElementById("targetBtn").style.backgroundColor = "white";
    }
  }

  function placeCar() {
    graphEditor.placeCarFlag = !graphEditor.placeCarFlag;
    if (graphEditor.placeCarFlag) {
      document.querySelector("#btnCar").style.backgroundColor = "red";
    } else {
      document.querySelector("#btnCar").style.backgroundColor = "white";
    }
  }

  function dispOffsets() {
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      if (car.acceleration == 0) {
        car.acceleration = 0.1;
        console.log("bias2", car.brain.bias2, "bias3", car.brain.bias3);
      } else {
        carPaused = false;
        if (window.lastTarget) {
          console.log("🔄 恢復前往目標：", lastTarget);
          setTargetFromCar(lastTarget.x, lastTarget.y);
        }
        console.log("▶️ 車輛繼續前進");
      }
    }
  }

  function stopcar() {
    isStopped = true;
    for (let i = 0; i < cars.length; i++) {
      cars[i].acceleration = 0;
      cars[i].speed = 0;
    }
    console.log("🚗 車輛已停止");
  }

  // 學院對應目標座標點
  const pavilionTargets = {
    EM: { x: 14454.600000000013, y: 11513.899999999996 },
    EL: { x: 14642.399999999987, y: 12515.899999999992},
    ES: { x: 15487.299999999988, y: 12694.599999999995 },
    EC: {x: 16141.699999999988, y: 12513.49999999999},
    EB: {x: 15839.099999999984, y: 10544.799999999988},
    EN: { x: 16387.29999999999, y: 11474.699999999993},
    DC1: { x: 12676.300000000014, y: 14456.399999999992 },
    DC2: {x: 12877.099999999988, y: 15427.599999999995},
    DA: { x: 14946.799999999988, y: 14132.799999999994 },
    MA: { x: 11826.799999999987, y: 12941.599999999993},
    MB: { x: 10758.600000000013, y: 13149.099999999995 },
    MD: { x: 10312.100000000013, y: 12185.599999999993 },
    DH: { x: 12573.100000000013, y: 13880.199999999997 },
    DS: { x: 14817.700000000013, y: 13445.899999999994 },
    FB: {x: 13083.399999999983, y: 16181.399999999994},
    FB2: { x: 17550.599999999984, y: 17901.19999999999 },
    A: { x: 14837.799999999983, y: 16764.199999999993 },
    B: { x: 13781.400000000014, y: 16971.9 },
    C: { x: 13330.299999999987, y: 17413.1},
    D: { x: 13450.300000000014, y: 18184.500000000004 },
    E: { x: 13799.399999999989, y: 17709.699999999993 },
    F: { x: 13478.099999999986, y: 18436.19999999999 },
    G: { x: 13217.699999999984, y: 16758.199999999997 },
    PD: { x: 15540.399999999985, y: 15045.799999999994 },
    ASP: {x: 16721.79999999999, y: 14787.799999999997},
    BK: { x: 14784.799999999983, y: 13244.799999999987 },
    BS: { x: 16069.399999999987, y: 16917.999999999993 },
    SR: { x: 16141.899999999967, y: 14915.299999999992 },
    VB: { x: 14921.399999999981, y: 13982.99999999999 },
    AC: { x: 12291.699999999988, y: 12184.199999999995 },
    AD: { x: 13830.099999999984, y: 10924.799999999992 },
    TL: {x: 12420.399999999985, y: 12918.599999999991},
    AS: { x: 14599.299999999985, y: 12283.499999999993 },
    ART: { x: 13392.499999999984, y: 13327.799999999992 },
    T: { x: 15617.899999999987, y: 13897.099999999995 },
    GA: { x: 13926.699999999968, y: 15469.399999999994 }
  };

  // 監聽下拉選單事件
  const selectEl = document.getElementById("subMapSelect");
  if (selectEl) {
    selectEl.addEventListener("change", (e) => {
      const key = e.target.value;
      if (!key) {
        console.log("尚未選擇目的地，車輛不動");
        return;
      }
      const destination = pavilionTargets[key];
      if (destination) {
        setTargetFromCar(destination.x, destination.y);
      }
    });
  }

  function setTargetFromCar(x, y) {
    if (typeof Target !== "undefined") {
      world.markings = world.markings.filter((m) => !(m instanceof Target));
      const newTarget = new Target(x, y);
      world.markings.push(newTarget);
    }
    const start = new Point(myCar.x, myCar.y);
    const end = new Point(x, y);
    graphEditor.start = start;
    graphEditor.end = end;
    for (let i = 0; i < cars.length; i++) {
      cars[i].setEndPoint(end);
      cars[i].stopped = false;
    }
    world.generateCorridor(start, end);
    roadBorders = world.corridor.map((s) => [s.p1, s.p2]);

    console.log(
      `🚗 新目標設定：從 (${start.x}, ${start.y}) 到 (${end.x}, ${end.y})`
    );
  }
let isDragging = false;
let lastTouchPos = null;

let lastTouchDist = null;
let lastMidpoint = null;

myCanvas.addEventListener("touchstart", function (e) {
    if (e.touches.length === 1) {
        // 啟動單指拖動
        isDragging = true;
        lastTouchPos = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };
    } else if (e.touches.length === 2) {
        // 啟動雙指縮放
        isDragging = false; // 防止混用
        lastTouchDist = getTouchDistance(e.touches[0], e.touches[1]);
        lastMidpoint = getTouchMidpoint(e.touches[0], e.touches[1]);
    }
}, { passive: false });

myCanvas.addEventListener("touchmove", function (e) {
    if (e.touches.length === 1 && isDragging) {
        // 單指拖動畫面
        e.preventDefault();

        const currentTouch = e.touches[0];
        const dx = currentTouch.clientX - lastTouchPos.x;
        const dy = currentTouch.clientY - lastTouchPos.y;

        viewport.offset.x += dx * viewport.zoom;
        viewport.offset.y += dy * viewport.zoom;

        lastTouchPos = {
            x: currentTouch.clientX,
            y: currentTouch.clientY
        };
    } else if (e.touches.length === 2) {
        // 雙指縮放
        e.preventDefault();

        const newDist = getTouchDistance(e.touches[0], e.touches[1]);
        const newMid = getTouchMidpoint(e.touches[0], e.touches[1]);

        const zoomFactor = lastTouchDist /  newDist;
        const newZoom = Math.max(1, Math.min(5, viewport.zoom * zoomFactor));

        const worldMidBefore = screenToWorld(lastMidpoint, viewport);
        const worldMidAfter = screenToWorld(newMid, viewport);

        viewport.offset = add(viewport.offset, subtract(worldMidAfter, worldMidBefore));
        viewport.zoom = newZoom;

        lastTouchDist = newDist;
        lastMidpoint = newMid;
    }
}, { passive: false });

myCanvas.addEventListener("touchend", function (e) {
    if (e.touches.length === 0) {
        // 所有手指離開時重置狀態
        isDragging = false;
        lastTouchPos = null;
        lastTouchDist = null;
        lastMidpoint = null;
    } else if (e.touches.length === 1) {
        // 如果從雙指變單指，則開始單指拖動
        isDragging = true;
        lastTouchPos = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };
    }
});

// 工具函式：兩點距離
function getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// 工具函式：兩點中點
function getTouchMidpoint(touch1, touch2) {
    return new Point(
        (touch1.clientX + touch2.clientX) / 2,
        (touch1.clientY + touch2.clientY) / 2
    );
}

// 工具函式：畫面座標轉世界座標
function screenToWorld(screenPt, viewport) {
    return new Point(
        (screenPt.x - viewport.center.x) * viewport.zoom - viewport.offset.x,
        (screenPt.y - viewport.center.y) * viewport.zoom - viewport.offset.y
    );
}

  // 將需要給外部呼叫的函式掛到 window
  window.store = store;
  window.cancel = cancel;
  window.dispose = dispose;
  window.animate = animate;
  window.save = save;
  window.load = load;
  window.setMode = setMode;
  window.placeCar = placeCar;
  window.dispOffsets = dispOffsets;
  window.stopcar = stopcar;
  window.viewport;
  window.getTouchDistance = getTouchDistance;
  window.getTouchMidpoint = getTouchMidpoint;
  window.screenToWorld = screenToWorld;
}
