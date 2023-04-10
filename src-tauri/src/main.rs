// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use ndarray::s;
use ndarray::Array2;
use ndarray::Axis;
use std::sync::Mutex;
use tauri::State;

#[derive(serde::Serialize)]
struct Field(Mutex<Array2<u8>>);

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn update_grid_dim(rows: u8, cols: u8, state: State<Field>) -> Array2<u8> {
    // println!("{:?}", state.0);

    let mut arr = state.0.lock().unwrap();
    let size = arr.shape();
    // println!("{:?}", size);

    let size_diff = (
        rows as isize - size[0] as isize,
        cols as isize - size[1] as isize,
    );

    match size_diff {
        (dr, dc) if dr < 0 || dc < 0 => {
            println!("shrink {:?} => {:?}", size, [rows, cols]);
            let new_field = arr.slice(s![0..rows as usize, 0..cols as usize]).to_owned();
            // println!("{:?}", new_field);
            *arr = new_field;
        }
        (dr, dc) if dr > 0 || dc > 0 => {
            println!("extend {:?} => {:?}", size, [rows, cols]);
            let dr = dr as usize;
            let dc = dc as usize;
            let new_row = Array2::zeros((dr, size[1]));
            let new_col = Array2::zeros((size[0] + dr, dc));
            // println!("{:?}", new_row);
            // let new_field = stack(Axis(0), &[arr.view(), new_row.view()]);
            let _ = arr.append(Axis(0), new_row.view());
            let _ = arr.append(Axis(1), new_col.view());
            // println!("{:?}", arr);
        }
        (_, _) => {}
    }

    arr.clone()
}

#[tauri::command]
fn flip(i: u8, k: u8, state: State<Field>) -> Array2<u8> {
    let mut arr = state.0.lock().unwrap();
    let i = i as usize;
    let k = k as usize;
    arr[[i, k]] = if arr[[i, k]] == 1 { 0 } else { 1 };
    arr.clone()
}

#[tauri::command]
fn step_one_generation(state: State<Field>) -> Array2<u8> {
    let mut arr = state.0.lock().unwrap();
    let size = arr.shape();
    let mut next = Array2::zeros((size[0], size[1]));

    let window_arr = Array2::from_shape_vec(
        (3, 3),
        vec![
            [-1, -1],
            [-1, 0],
            [-1, 1],
            [0, -1],
            [0, 0],
            [0, 1],
            [1, -1],
            [1, 0],
            [1, 1],
        ],
    )
    .unwrap();

    // println!("{:?}", window_arr);

    for i in 0..size[0] {
        for j in 0..size[1] {
            let top = if i as isize - 1 < 0 { 1 } else { 0 };
            let bottom = if i + 1 > (size[0] - 1) { 2 } else { 3 };
            let left = if j as isize - 1 < 0 { 1 } else { 0 };
            let right = if j + 1 > (size[1] - 1) { 2 } else { 3 };

            // println!("[{}..{}]", left, right);
            // println!("[{}..{}]", top, bottom);

            let sliced_window = window_arr.slice(s![top..bottom, left..right]).to_owned();

            // println!("{:?}", sliced_window);

            let indices = sliced_window.into_raw_vec();
            // println!("{:?}", indices);

            let center = arr[[i, j]];
            let lives = indices
                .iter()
                .map(|[di, dj]| arr[[(i as isize + di) as usize, (j as isize + dj) as usize]])
                .collect::<Vec<_>>();

            let sum: u8 = lives.iter().sum();
            let sum = sum - center;
            // println!("{}", sum);

            if center == 0 && sum == 3 {
                next[[i, j]] = 1;
            } else if center == 1 && sum >= 4 {
                next[[i, j]] = 0;
            } else if center == 1 && sum <= 1 {
                next[[i, j]] = 0;
            } else if center == 1 && (sum == 2 || sum == 3) {
                next[[i, j]] = 1;
            } else {
                //nothing
            }
        }
    }

    *arr = next.clone();
    next
}

fn main() {
    let field = Field(Mutex::new(Array2::zeros((10, 10))));

    tauri::Builder::default()
        .manage(field)
        .invoke_handler(tauri::generate_handler![
            greet,
            update_grid_dim,
            flip,
            step_one_generation
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
