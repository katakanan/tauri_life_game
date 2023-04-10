import { FC, useCallback, useRef, useState, useEffect, useReducer } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";
import produce from 'immer';

const numRows = 10;
const numCols = 10;
const simDuration = 500;

const operations = [
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
  [-1, -1],
  [1, 0],
  [-1, 0]
];

const App: FC = () => {
  // function App(){
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [grid, setGrid] = useState(() => {
    const rows = [];
    for (let i = 0; i < numRows; i++) {
      rows.push(Array.from(Array(numCols), () => 0));
    }

    return rows;
  });

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    setGreetMsg(await invoke("greet", { name }));
  }

  const [running, setRunning] = useState(false);

  const runningRef = useRef(running);
  runningRef.current = running;

  const runSimulation = useCallback(() => {
    if (!runningRef.current) {
      return;
    }

    setGrid((g) => {
      return produce(g, gridCopy => {
        for (let i = 0; i < numRows; i++) {
          for (let k = 0; k < numCols; k++) {
            let neighbors = 0;
            operations.forEach(([x, y]) => {
              const newI = i + x;
              const newK = k + y;
              if (newI >= 0 && newI < numRows && newK >= 0 && newK < numCols) {
                neighbors += g[newI][newK]
              }
            });

            if (neighbors < 2 || neighbors > 3) {
              gridCopy[i][k] = 0;
            } else if (g[i][k] === 0 && neighbors === 3) {
              gridCopy[i][k] = 1;
            }
          }
        }
      });
    });

    setTimeout(runSimulation, simDuration);
    // simulate
  }, [])

  const [yoko, setYoko] = useState(10);
  const [tate, setTate] = useState(10);
  const [field, setField] = useState(() => {
    const rows = [];
    for (let i = 0; i < yoko; i++) {
      rows.push(Array.from(Array(tate), () => 0));
    }
    return rows;
  });

  function Array2toField(arrayobj: any) {
    const row = arrayobj.dim[0];
    const col = arrayobj.dim[1];
    console.log(`row : ${row}`);
    console.log(`col : ${col}`);
    const field = [];

    for (let i = 0; i < row; i++) {
      field.push(arrayobj.data.slice(i * col, (i + 1) * col));
    }

    return field;
  }

  async function update_grid_dim(s_yoko: string, s_tate: string) {
    const numRows = Number(s_yoko);
    const numCols = Number(s_tate);

    if (!(5 <= numRows && numRows <= 10)) {
      return;
    }

    if (!(5 <= numCols && numCols <= 10)) {
      return;
    }

    setYoko(numRows);
    setTate(numCols);

    // setGreetMsg(await invoke("greet", { name }));
    console.log("set field W x H = %d x %d", numRows, numCols);

    const field_obj = await invoke("update_grid_dim", { "rows": numRows, "cols": numCols });
    // console.log(field_obj);

    setField(Array2toField(field_obj));

  }

  async function flip(i: number, k: number) {
    const field_obj = await invoke("flip", { "i": i, "k": k });
    setField(Array2toField(field_obj));
  }

  async function runSimulation2() {
    if (!runningRef.current) {
      return;
    }

    const field_obj = await invoke("step_one_generation", {});

    setField(Array2toField(field_obj));
    setTimeout(runSimulation2, simDuration);
    // simulate
  }

  async function step_run() {
    if (runningRef.current) {
      return;
    }
    const field_obj = await invoke("step_one_generation", {});
    setField(Array2toField(field_obj));
  }

  const grid_parent = useRef<HTMLDivElement>(null);
  const grid_ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let grid_init_height = grid_ref.current?.clientHeight
    grid_init_height ??= 220;

    // console.log(grid_init_height)
    if (grid_parent.current) {
      grid_parent.current.style.height = `${grid_init_height + 20}px`;
    }
  }, []);

  return (
    <div className="container">
      <h1>Welcome to Tauri!</h1>
      <div className="row">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            greet();
          }}>
          <input
            id="greet-input"
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Enter a name..."
          />
          <button type="submit">Greet</button>
        </form>
      </div>
      <p>{greetMsg}</p>
      <div className="row">
        <input
          id="num_row"
          className="num_input"
          type="number"
          value={yoko}
          onChange={(e) => {
            // setYoko(Number(e.currentTarget.value));
            update_grid_dim(e.currentTarget.value, String(tate));
          }}
        />
      </div>
      <div className="row">
        <input
          id="num_col"
          className="num_input"
          type="number"
          value={tate}
          onChange={(e) => {
            // setTate(Number(e.currentTarget.value))
            update_grid_dim(String(yoko), e.currentTarget.value);
          }}
        />
      </div>
      <div className="row">
        <button onClick={() => {
          setRunning(!running);
          if (!running) {
            runningRef.current = true;
            runSimulation();
            runSimulation2();
          }
        }}>{running ? 'stop' : 'start'}
        </button>
        <button
          onClick={() => {
            step_run();
          }}>
          step
        </button>
      </div>
      <div className="sub_container">
        <div className="life_game">
          <h1>Life game Typescript!</h1>
          <div className="row">
            <>
              <div id="grid_parent" style={{ height: '240px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${numCols}, 20px)`
                }}>
                  {grid.map((rows, i) =>
                    rows.map((col, k) => (
                      <div
                        key={`${i} - ${k}`}
                        onClick={() => {
                          const newGrid = produce(grid, gridCopy => {
                            gridCopy[i][k] = grid[i][k] ? 0 : 1;
                          })
                          setGrid(newGrid)
                        }}
                        style={{
                          width: 20,
                          height: 20,
                          backgroundColor: grid[i][k] ? 'green' : undefined,
                          border: 'solid 1px black'
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            </>
          </div>
        </div>
        <div className="life_game">
          <h1>Life game Tauri!</h1>
          <div className="row">
            <>
              <div ref={grid_parent} id="grid_parent">
                <div
                  ref={grid_ref}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${tate}, 20px)`
                  }}>
                  {field.map((rows, i) =>
                    rows.map((col, k) => (
                      <div
                        key={`${i} - ${k}`}
                        onClick={() => {
                          console.log(`clicked ${i} ${k}`);
                          flip(i, k);
                        }}
                        style={{
                          width: 20,
                          height: 20,
                          backgroundColor: field[i][k] ? 'green' : undefined,
                          border: 'solid 1px black'
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            </>
          </div>
        </div>
      </div>
    </div >
  );
}

export default App;
