import { useEffect, useState, useRef } from "react";
import { fabric } from "fabric";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";
import randomColor from "randomcolor";
import './App.css';

function App() {
  const [others, setOthers] = useState([]);
  const yRef = useRef(null);

  useEffect(() => {
    if (!yRef.current) {
      const canvas = new fabric.Canvas("whiteboard", { width: 900, height: 600 });

      const ydoc = new Y.Doc();
      const ymap = ydoc.getMap("shapes");
      yRef.current = ymap;

      const doShape = event => {
        event.changes.keys.forEach((change, key) => {
          if (change.action === 'add') {
            let obj = ymap.get(key);
            canvas.add(new fabric[obj.shape]({ ...obj, key, hasControls: false, selectable: true }))

            console.log("The shape was added.");
          } else if (change.action === 'update') {
            let obj = ymap.get(key);
            let shape = canvas.getObjects().find(obj => obj.key === key);
            shape.set({ ...obj, key, hasControls: false, selectable: true });
            shape.setCoords();

            console.log("The shape was updated.");
          } else if (change.action === 'delete') {
            let shape = canvas.getObjects().find(obj => obj.key === key);
            canvas.remove(shape);

            console.log("The shape was deleted.")
          }
        });

        canvas.requestRenderAll();
      };

      ymap.observe(doShape);

      const provider = new WebsocketProvider('ws://localhost:1234', 'my-rommname', ydoc);
      provider.on('status', event => {
        console.log(event.status) // logs "connected" or "disconnected"
      });

      // offline support
      const persistence = new IndexeddbPersistence("my-roomname", ydoc);
      persistence.once('synced', () => { console.log('initial content loaded') });

      const awareness = provider.awareness;
      const clientId = awareness.clientID;
      awareness.on("change", changes => {
        setOthers([...awareness.getStates().entries()].filter(entry => {
          return entry[0] !== clientId;
        }).map(entry => entry[1]));
      });

      awareness.setLocalState({
        color: randomColor(),
        cursor: {}
      });

      document.addEventListener("mousemove", event => {
        awareness.setLocalStateField("cursor", { x: event.clientX, y: event.clientY });
      });

      const doMovingOrDragleaveShape = opt => {
        let shape = { left: opt.e.offsetX, top: opt.e.offsetY, fill: opt.target.fill, shape: opt.target.shape };

        if (opt.target.shape === "Rect") {
          shape.height = opt.target.height;
          shape.width = opt.target.width;
        } else if (opt.target.shape === "Circle") {
          shape.andgle = opt.target.angle;
          shape.radius = opt.target.radius;
        }

        ymap.set(opt.target.key, shape);
      }

      canvas.on("object:moving", doMovingOrDragleaveShape);
      canvas.on("dragleave", doMovingOrDragleaveShape);
    }
  }, []);

  function getRandomInt(max) {
    return Math.floor(Math.random() * max);
  }

  const addRectangle = () => {
    let key = String(new Date());

    let rect = {
      left: getRandomInt(300),
      top: getRandomInt(300),
      fill: randomColor(),
      width: 70,
      height: 70,
      shape: "Rect"
    };

    yRef.current.set(key, rect);
  };

  const addCircle = () => {
    let key = String(new Date());

    let circle = {
      left: getRandomInt(300),
      top: getRandomInt(300),
      fill: randomColor(),
      angle: 50,
      radius: 40,
      shape: "Circle"
    };

    yRef.current.set(key, circle);
  }

  const deleteLastAdded = () => {
    let shapes = [...yRef.current.entries()];
    if (shapes.length === 0) return;

    let lastShape = shapes[shapes.length - 1];
    yRef.current.delete(lastShape[0]);
  };

  return (
    <div className="App">
      <div id="toolbar">
        <button type="button" onClick={addRectangle}>Rectangle</button>
        <button type="button" onClick={addCircle}>Circle</button>
        <button type="button" onClick={deleteLastAdded}>Delete Last</button>
      </div>
      <canvas id="whiteboard"></canvas>
      {others.map(state => {
        return <div className="cursor" key={state.color} style={{ position: "fixed", left: state.cursor.x, top: state.cursor.y, backgroundColor: state.color }}></div>
      })}
    </div>
  );
}

export default App;
