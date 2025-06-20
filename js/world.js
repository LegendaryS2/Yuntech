class World {
  constructor(
    graph, 
    roadWidth = 100, 
    roadRoundness = 10,
    buildingWidth = 150,
    buildingMinLength = 150,
    spacing = 50,
    treeSize = 160
  ) {
    this.graph = graph;
    this.roadWidth = roadWidth;
    this.roadRoundness = roadRoundness;
    this.buildingWidth = buildingWidth;
    this.buildingMinLength = buildingMinLength;
    this.spacing = spacing;
    this.treeSize = treeSize;

    this.markings = [];
    this.envelopes = [];
    this.roadBorders = [];
    this.buildings = [];
    this.trees = [];
    this.waters = [];
    this.grass = [];
    this.pitch = [];
    this.park = [];
    this.court = [];

    this.generate();
  }

  static load(info){
    const world = new World(new Graph());
    world.graph = Graph.load(info.graph);
    world.roadWidth = info.roadWidth;
    world.roadRoundness = info.roadRoundness;
    world.buildingWidth = info.buildingWidth;
    world.buildingMinLength = info.buildingMinLength;
    world.spacing = info.spacing;
    world.treeSize = info.treeSize;
    world.envelopes = info.envelopes.map((e) => Envelope.load(e));
    world.roadBorders = info.roadBorders.map((b) => new Segment(b.p1, b.p2));
    world.buildings = info.buildings.map((e) => Building.load(e));
    world.waters = (info.waters || []).map((e) => Water.load(e));
    world.grass = (info.grass || []).map((e) => Grass.load(e));
    world.pitch = (info.pitch || []).map((e) => Pitch.load(e));
    world.court = (info.court || []).map((e) => Court.load(e));
    world.park = (info.park || []).map((e) => Park.load(e));
    // world.trees =  info.trees.map((t) => new Tree(t.center, info.treeSize));
   
    
    // world.laneGuides = info.laneGuides.map((g) => new Segment(g.p1, g.p2));
    world.zoom = info.zoom;
    world.offset = info.offset;
    return world;
  }

  generate() {
    this.envelopes.length = 0;

    for (const seg of this.graph.segments) {
      this.envelopes.push(
        new Envelope(seg, this.roadWidth, this.roadRoundness)
      );
    }

    this.roadBorders = Polygon.union(this.envelopes.map((e) => e.poly));
    // this.buildings = this.#generateBuildings();
    // this.trees = this.#generateTrees();
    
    
    
  }

  #generateTrees() {
    const points =[
      ...this.roadBorders.map((s) => [s.p1, s.p2]).flat(),
      ...this.buildings.map((b) => b.base.points).flat()
    ];
    const left = Math.min(...points.map((p) => p.x));
    const right = Math.max(...points.map((p) => p.x));
    const top = Math.min(...points.map((p) => p.y));
    const bottom = Math.max(...points.map((p) => p.y));

    const illegalPolys = [
      ...this.buildings.map((b) => b.base),
      ...this.envelopes.map((e) => e.poly)
    ];

    

   const trees = [];
   let tryCount = 0;
   while (tryCount < 100)  {
    const p = new Point(
      lerp(left, right, Math.random()),
      lerp(bottom, top, Math.random())
    );

    let keep = true;
    for (const poly of illegalPolys) {
      if(poly.containsPoint(p) || poly.distanceToPoint(p) < this.treeSize / 2 ) {
        keep = false;
        break;
      }  
    }
    if (keep) {
      for (const tree of trees) {
        if (distance(tree.center, p) < this.treeSize ) {
          keep = false;
          break;
        }
      }
    }
    if (keep) {
      let closeToSomething = false;
      for (const poly of illegalPolys) {
        if (poly.distanceToPoint(p) < this.treeSize * 2) {
          closeToSomething = true;
          break;
        }
      }
      keep = closeToSomething;
    }

    if(keep) {
      trees.push(new Tree(p, this.treeSize));
      tryCount = 0;
    }
    tryCount++;
   }
   return trees;
  }

      #generateBuildings() {
      const tmpEnvelopes = [];
      for (const seg of this.graph.segments) {
         tmpEnvelopes.push(
            new Envelope(
               seg,
               this.roadWidth + this.buildingWidth + this.spacing * 2,
               this.roadRoundness
            )
         );
      }
     

      const guides = Polygon.union(tmpEnvelopes.map((e) => e.poly));
      for (let i = 0; i < guides.length; i++) {
         const seg = guides[i];
         if (seg.length() < this.buildingMinLength) {
            guides.splice(i, 1);
            i--;
         }
      }

       const supports = [];
      for (let seg of guides) {
         const len = seg.length() + this.spacing;
         const buildingCount = Math.floor(
            len / (this.buildingMinLength + this.spacing)
         );
         const buildingLength = len / buildingCount - this.spacing;

         const dir = seg.directionVector();

         let q1 = seg.p1;
         let q2 = add(q1, scale(dir, buildingLength));
         supports.push(new Segment(q1, q2));
         for (let i = 2; i <= buildingCount; i++) {
            q1 = add(q2, scale(dir, this.spacing));
            q2 = add(q1, scale(dir, buildingLength));
            supports.push(new Segment(q1, q2));
         }
         }
         const bases = [];
      for (const seg of supports) {
         bases.push(new Envelope(seg, this.buildingWidth).poly);
      }
      const eps = 0.001;
      for (let i = 0; i < bases.length - 1; i++) {
         for (let j = i + 1; j < bases.length; j++) {
            if (
               bases[i].intersectsPoly(bases[j]) ||
               bases[i].distanceToPoly(bases[j]) < this.spacing - eps
            ) {
               bases.splice(j, 1);
               j--;
            }
         }
      }
       return bases.map((b) => new Building(b));
      }



   generateCorridor(start, end) {
    // 1. 先移除上次加進去的 corridor segment
    if (this._lastCorridorTmpSegs && Array.isArray(this._lastCorridorTmpSegs)) {
      for (const seg of this._lastCorridorTmpSegs) {
        const idx = this.graph.segments.indexOf(seg);
        if (idx !== -1) this.graph.segments.splice(idx, 1);
      }
    }
    this._lastCorridorTmpSegs = [];

    const startSeg = getNearestSegment(start, this.graph.segments);
    const endSeg = getNearestSegment(end, this.graph.segments);

    const { point: projStart } = startSeg.projectPoint(start);
    const { point: projEnd } = endSeg.projectPoint(end);

    this.graph.points.push(projStart);
    this.graph.points.push(projEnd);

    const tmpSegs = [
      new Segment(startSeg.p1, projStart),
      new Segment(projStart, startSeg.p2),
      new Segment(endSeg.p1, projEnd),
      new Segment(projEnd, endSeg.p2),
    ];

    if (startSeg.equals(endSeg)) {
      tmpSegs.push(new Segment(projStart, projEnd));
    }

    // 2. 記錄這次加進去的 corridor segment
    this.graph.segments = this.graph.segments.concat(tmpSegs);
    this._lastCorridorTmpSegs = tmpSegs;

    const path = this.graph.getShortestPath(projStart, projEnd);

    this.graph.removePoint(projStart);
    this.graph.removePoint(projEnd);

    const segs = [];
    for (let i = 1; i < path.length; i++) {
      segs.push(new Segment(path[i - 1], path[i]));
    }

    const tmpEnvelopes = segs.map(
      (s) => new Envelope(s, this.roadWidth, this.roadRoundness)
    );

    const segments = Polygon.union(tmpEnvelopes.map((e) => e.poly));

    this.corridor = segments;

    const traffic = [];

    let roadBorders = [];
    const target = this.markings.find((m) => m instanceof Target);
    if (target) {
      this.generateCorridor(bestCar, target.center);
      roadBorders = this.corridor.map((s) => [s.p1, s.p2]);
    } else {
      roadBorders = this.roadBorders.map((s) => [s.p1, s.p2]);
    }

    // animate();
  }

  draw(ctx, viewPoint) {
    for (const water of this.waters) {
    water.draw(ctx);
    }
    for (const grass of this.grass) {
    grass.draw(ctx);
    }
    for (const court of this.court) {
      court.draw(ctx);
    }
    for (const pitch of this.pitch) {
        pitch.draw(ctx);
    }
    for (const env of this.envelopes) {
      env.draw(ctx, { fill: "#BBB", stroke: "#BBB", lineWidth: 15 });
    }
    for (const seg of this.graph.segments) {
      seg.draw(ctx, { color: "white", width: 4, dash: [10, 10] });
    }
    for (const seg of this.roadBorders) {
      seg.draw(ctx, { color: "white", width: 4 });
    }
    for(const park of this.park){
      park.draw(ctx);
    }
    const items = [...this.buildings, ...this.trees];
    items.sort(
      (a, b) =>
        b.base.distanceToPoint(viewPoint) - 
        a.base.distanceToPoint(viewPoint)
    );
    for (const item of items) {
      item.draw(ctx, viewPoint);
    }
    
    if (this.corridor) {
      for (const seg of this.corridor) {
        seg.draw(ctx, { color: "red", width: 4 });
      }
    }
  }
}
