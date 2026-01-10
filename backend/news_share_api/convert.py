import os

file_path = "data.json"

def convert_to_utf8(path):
    with open(path, "rb") as f:
        raw = f.read()

    # Try reading as UTF-8
    try:
        raw.decode("utf-8")
        print("✔ File is already UTF-8. No changes made.")
        return
    except UnicodeDecodeError:
        pass

    # Try reading as UTF-16 and convert to UTF-8
    try:
        text = raw.decode("utf-16")
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        print("🔄 Converted from UTF-16 to UTF-8 successfully!")
    except UnicodeDecodeError:
        print("❌ Error: File is not UTF-8 or UTF-16.")
        print("   Make sure the file encoding is correct.")

if __name__ == "__main__":
    if os.path.exists(file_path):
        convert_to_utf8(file_path)
    else:
        print("❌ data.json not found in the current folder.")
