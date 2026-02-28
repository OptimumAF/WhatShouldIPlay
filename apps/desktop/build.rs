use std::path::PathBuf;

fn main() {
    println!("cargo:rerun-if-changed=../../public/icons/icon.svg");

    #[cfg(target_os = "windows")]
    if let Err(error) = embed_windows_icon() {
        panic!("failed to embed windows icon from favicon: {error}");
    }
}

#[cfg(target_os = "windows")]
fn embed_windows_icon() -> Result<(), Box<dyn std::error::Error>> {
    use ico::{IconDir, IconDirEntry, IconImage, ResourceType};
    use resvg::{tiny_skia, usvg};
    use std::{env, fs::File};

    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR")?);
    let svg_path = manifest_dir.join("../../public/icons/icon.svg");
    let svg_bytes = std::fs::read(&svg_path)?;

    let mut options = usvg::Options::default();
    options.resources_dir = svg_path.parent().map(|path| path.to_path_buf());
    let tree = usvg::Tree::from_data(&svg_bytes, &options)?;
    let tree_size = tree.size();

    let mut icon_dir = IconDir::new(ResourceType::Icon);
    for size in [16_u32, 24, 32, 48, 64, 128, 256] {
        let mut pixmap =
            tiny_skia::Pixmap::new(size, size).ok_or("could not allocate icon pixmap")?;

        let transform = tiny_skia::Transform::from_scale(
            size as f32 / tree_size.width(),
            size as f32 / tree_size.height(),
        );

        let mut pixmap_mut = pixmap.as_mut();
        resvg::render(&tree, transform, &mut pixmap_mut);

        let image = IconImage::from_rgba_data(size, size, pixmap.take());
        icon_dir.add_entry(IconDirEntry::encode(&image)?);
    }

    let out_dir = PathBuf::from(env::var("OUT_DIR")?);
    let icon_path = out_dir.join("whatshouldiplay.ico");
    let mut icon_file = File::create(&icon_path)?;
    icon_dir.write(&mut icon_file)?;

    let mut resources = winres::WindowsResource::new();
    resources.set_icon(icon_path.to_string_lossy().as_ref());
    resources.compile()?;

    Ok(())
}
