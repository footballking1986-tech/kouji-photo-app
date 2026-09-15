import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";
import "./App.css";

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

   // ログイン状態を確認
  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);
      setAuthLoading(false);
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const [projectName, setProjectName] = useState("");
  const [projectId, setProjectId] = useState(null);

  const [locations, setLocations] = useState([]);
  const [newLocation, setNewLocation] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedAngle, setSelectedAngle] = useState(null);

  const [photos, setPhotos] = useState([]);

  const [message, setMessage] = useState("");

  const [angles, setAngles] = useState([]);

// Supabaseから撮影アングルを読み込む

const loadPhotoAngles = async () => {

  if (!projectId) return;

  let allData = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {

    const { data, error } = await supabase
      .from("photo_angles")
      .select("*")
      .range(from, from + pageSize - 1);

    if (error) {

      console.error(
        "撮影アングルの読み込みエラー:",
        error
      );

      return;
    }

    allData = [...allData, ...(data || [])];

    if (!data || data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  const convertedAngles = allData.map(
    (item) => ({
      id: item.id,
      locationId: item.location_id,
      angleName: item.angle_name,
    })
  );

 setAngles(convertedAngles);

console.log(
  "取得した撮影アングル:",
  convertedAngles
);

console.log(
  "選択中の撮影場所:",
  selectedLocation
);

console.log(
  "選択中の場所に一致するアングル:",
  convertedAngles.filter(
    (angle) =>
      selectedLocation &&
      angle.locationId === selectedLocation.id
  )
);

};

// 工事を読み込んだときに撮影アングルを読み込む
useEffect(() => {
  loadPhotoAngles();
}, [projectId]);

// Supabaseから保存済み写真を読み込む
const loadPhotos = async () => {
  if (!projectId) {
    console.log("projectIdがありません");
    return;
  }

  console.log(
    "写真を読み込みます。projectId:",
    projectId
  );

  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    console.error(
      "保存済み写真の読み込みエラー:",
      error
    );
    return;
  }

  console.log(
    "Supabaseから取得した写真:",
    data
  );

  if (!data || data.length === 0) {
    console.log(
      "保存済み写真がありません"
    );

    setPhotos([]);
    return;
  }

const convertedPhotos = await Promise.all(
  data.map(async (item) => {
    const {
      data: signedUrlData,
      error: signedUrlError,
    } = await supabase.storage
      .from("construction-photos")
      .createSignedUrl(
        item.file_path,
        3600
      );

    if (signedUrlError) {
      console.error(
        "写真URLの取得エラー:",
        signedUrlError
      );

      return null;
    }

    const photoUrl =
      signedUrlData.signedUrl;

    console.log(
      "署名付き写真URL:",
      photoUrl
    );

    return {
      id: item.id,
      url: photoUrl,
      locationId: item.location_id,
      angleId: item.angle_id,
      filePath: item.file_path,
    };
  })
);

setPhotos(
  convertedPhotos.filter(Boolean)
);

  console.log(
    "画面に設定する写真:",
    convertedPhotos
  );

  setPhotos(convertedPhotos);
};

// 工事を読み込んだときに写真を読み込む
useEffect(() => {
  loadPhotos();
}, [projectId]);


  // Supabaseから工事を読み込む
  useEffect(() => {
    loadProject();
  }, []);

  const loadProject = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error(error);
        return;
      }

      if (data && data.length > 0) {
        setProjectId(data[0].id);
        setProjectName(data[0].name);

        await loadLocations(data[0].id);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // 撮影場所をSupabaseから読み込む
  const loadLocations = async (id) => {
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    if (data) {
      const converted = data.map((item) => ({
        id: item.id,
        floor: item.floor || "",
        drawingNumber: item.drawing_number || "",
        roomNumber: item.room_number || "",
        roomName: item.room_name || "",
      }));

      setLocations(converted);
    }
  };

  // 最新情報に更新する
const refreshData = async () => {
  if (!projectId) {
    alert("工事が読み込まれていません。");
    return;
  }

  setMessage("最新情報を読み込んでいます...");

  try {
    // 撮影場所を更新
    await loadLocations(projectId);

    // 撮影アングルを更新
    await loadPhotoAngles();

    // 写真を更新
    await loadPhotos();

    // 現在選択している撮影場所も最新状態にする
    if (selectedLocation) {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("id", selectedLocation.id)
        .single();

      if (!error && data) {
        setSelectedLocation({
          id: data.id,
          floor: data.floor || "",
          drawingNumber: data.drawing_number || "",
          roomNumber: data.room_number || "",
          roomName: data.room_name || "",
        });
      }
    }

    setMessage("🔄 最新情報に更新しました。");
  } catch (error) {
    console.error(
      "最新情報の更新エラー:",
      error
    );

    setMessage(
      "最新情報の更新に失敗しました。"
    );
  }
};

  // 工事名をSupabaseに保存
  const saveProject = async () => {
    if (!projectName.trim()) {
      alert("工事名を入力してください。");
      return;
    }

    try {
      // 既存の工事がある場合は更新
      if (projectId) {
        const { error } = await supabase
          .from("projects")
          .update({
            name: projectName,
          })
          .eq("id", projectId);

        if (error) throw error;

        setMessage("工事名を更新しました。");
        return;
      }

      // 新しい工事を登録
      const { data, error } = await supabase
        .from("projects")
        .insert([
          {
            name: projectName,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setProjectId(data.id);

      setMessage("工事名をSupabaseに保存しました。");
    } catch (error) {
      console.error(error);
      alert("工事名の保存に失敗しました。");
    }
  };

  // 手入力で撮影場所を追加
  const addLocation = async () => {
    if (!newLocation.trim()) return;

    if (!projectId) {
      alert("先に工事名を保存してください。");
      return;
    }

    const { data, error } = await supabase
      .from("locations")
      .insert([
        {
          project_id: projectId,
          floor: "",
          drawing_number: "",
          room_number: "",
          room_name: newLocation,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      alert("撮影場所の保存に失敗しました。");
      return;
    }

    const newItem = {
      id: data.id,
      floor: data.floor || "",
      drawingNumber: data.drawing_number || "",
      roomNumber: data.room_number || "",
      roomName: data.room_name || "",
    };

    setLocations([...locations, newItem]);
    setNewLocation("");
  };

  // 撮影場所を削除
  const deleteLocation = async (id) => {
    const { error } = await supabase
      .from("locations")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("撮影場所の削除に失敗しました。");
      return;
    }

    setLocations(
      locations.filter((location) => location.id !== id)
    );

    setPhotos(
      photos.filter(
        (photo) => photo.locationId !== id
      )
    );
  };

  // Excelを読み込む
const handleExcelUpload = async (event) => {
  const file = event.target.files[0];

  if (!file) return;

  if (!projectId) {
    alert("先に工事名を保存してください。");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);

      const workbook = XLSX.read(data, {
        type: "array",
      });

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json(
        worksheet,
        {
          defval: "",
        }
      );

      if (rows.length === 0) {
        alert("Excelにデータがありません。");
        return;
      }

      // ==============================
      // Excelの内容を整理
      // ==============================

      const locationMap = new Map();

      rows.forEach((row) => {
        const floor = String(row["フロア"] || "");
        const drawingNumber = String(
          row["図面番号"] || ""
        );
        const roomNumber = String(
          row["部屋番号"] || ""
        );
        const roomName = String(
          row["部屋名"] || ""
        );
        const angleName = String(
          row["撮影アングル"] || ""
        );

        const key = [
          floor,
          drawingNumber,
          roomNumber,
          roomName,
        ].join("|");

        if (!locationMap.has(key)) {
          locationMap.set(key, {
            floor,
            drawingNumber,
            roomNumber,
            roomName,
            angles: [],
          });
        }

        if (
          angleName &&
          !locationMap
            .get(key)
            .angles.includes(angleName)
        ) {
          locationMap
            .get(key)
            .angles.push(angleName);
        }
      });

      const excelLocations =
        Array.from(locationMap.values());

      if (excelLocations.length === 0) {
        alert("撮影場所が見つかりませんでした。");
        return;
      }

      // ==============================
      // 既存の撮影場所を取得
      // ==============================

      const {
        data: existingLocations,
        error: existingError,
      } = await supabase
        .from("locations")
        .select("*")
        .eq("project_id", projectId);

      if (existingError) {
        console.error(existingError);

        alert(
          "既存の撮影場所を取得できませんでした。"
        );

        return;
      }

      // ==============================
// Excelに存在しない古い撮影場所を削除
// ==============================

const excelLocationKeys = new Set(
  excelLocations.map((location) =>
    [
      location.floor,
      location.drawingNumber,
      location.roomNumber,
      location.roomName,
    ].join("|")
  )
);

const locationsToDelete =
  existingLocations.filter((location) => {
    const key = [
      location.floor || "",
      location.drawing_number || "",
      location.room_number || "",
      location.room_name || "",
    ].join("|");

    return !excelLocationKeys.has(key);
  });

console.log(
  "削除対象の古い撮影場所:",
  locationsToDelete
);

// 古い撮影場所を削除
for (const oldLocation of locationsToDelete) {

  // ① その場所の写真を取得
  const {
    data: oldPhotos,
    error: oldPhotosError,
  } = await supabase
    .from("photos")
    .select("*")
    .eq("location_id", oldLocation.id);

  if (oldPhotosError) {
    console.error(
      "古い写真の取得エラー:",
      oldPhotosError
    );

    alert(
      "古い写真の取得に失敗しました。\n\n" +
      oldPhotosError.message
    );

    return;
  }

  // ② Storageから写真ファイルを削除
  if (oldPhotos && oldPhotos.length > 0) {

    const filePaths = oldPhotos
      .map((photo) => photo.file_path)
      .filter(Boolean);

    if (filePaths.length > 0) {

      const {
        error: storageDeleteError,
      } = await supabase.storage
        .from("construction-photos")
        .remove(filePaths);

      if (storageDeleteError) {
        console.error(
          "古い写真ファイルの削除エラー:",
          storageDeleteError
        );

        alert(
          "古い写真ファイルの削除に失敗しました。\n\n" +
          storageDeleteError.message
        );

        return;
      }
    }

    // ③ photosテーブルから削除
    const {
      error: photosDeleteError,
    } = await supabase
      .from("photos")
      .delete()
      .eq("location_id", oldLocation.id);

    if (photosDeleteError) {
      console.error(
        "古い写真情報の削除エラー:",
        photosDeleteError
      );

      alert(
        "古い写真情報の削除に失敗しました。\n\n" +
        photosDeleteError.message
      );

      return;
    }
  }

  // ④ 撮影アングルを削除
  const {
    error: angleDeleteError,
  } = await supabase
    .from("photo_angles")
    .delete()
    .eq("location_id", oldLocation.id);

  if (angleDeleteError) {
    console.error(
      "古い撮影アングルの削除エラー:",
      angleDeleteError
    );

    alert(
      "古い撮影アングルの削除に失敗しました。\n\n" +
      angleDeleteError.message
    );

    return;
  }

  // ⑤ 撮影場所を削除
  const {
    error: locationDeleteError,
  } = await supabase
    .from("locations")
    .delete()
    .eq("id", oldLocation.id);

  if (locationDeleteError) {
    console.error(
      "古い撮影場所の削除エラー:",
      locationDeleteError
    );

    alert(
      "古い撮影場所の削除に失敗しました。\n\n" +
      locationDeleteError.message
    );

    return;
  }

  console.log(
    "古い撮影場所を削除しました:",
    oldLocation.room_name
  );
}

      // ==============================
      // 撮影場所を登録
      // ==============================

      const locationResults = [];

      for (const excelLocation of excelLocations) {
        const existing =
          existingLocations.find(
            (location) =>
              (location.floor || "") ===
                excelLocation.floor &&
              (location.drawing_number || "") ===
                excelLocation.drawingNumber &&
              (location.room_number || "") ===
                excelLocation.roomNumber &&
              (location.room_name || "") ===
                excelLocation.roomName
          );

if (existing) {
  // 既存の撮影場所を更新
  const { error: updateError } = await supabase
    .from("locations")
    .update({
      floor: excelLocation.floor,
      drawing_number: excelLocation.drawingNumber,
      room_number: excelLocation.roomNumber,
      room_name: excelLocation.roomName,
    })
    .eq("id", existing.id);

  if (updateError) {
    console.error("撮影場所の更新エラー:", updateError);

    alert(
      "撮影場所の更新に失敗しました。\n\n" +
      "エラー内容: " +
      updateError.message
    );

    return;
  }

  locationResults.push({
    ...existing,
    floor: excelLocation.floor,
    drawing_number: excelLocation.drawingNumber,
    room_number: excelLocation.roomNumber,
    room_name: excelLocation.roomName,
  });

} else {

  // なければ新規登録
  const {
    data: newLocation,
    error: insertError,
  } = await supabase
    .from("locations")
    .insert({
      project_id: projectId,
      floor: excelLocation.floor,
      drawing_number:
        excelLocation.drawingNumber,
      room_number:
        excelLocation.roomNumber,
      room_name:
        excelLocation.roomName,
    })
    .select()
    .single();

  if (insertError) {
    console.error(insertError);

    alert(
      "撮影場所の保存に失敗しました。"
    );

    return;
  }

  locationResults.push(newLocation);
}
      }

      // ==============================
      // 撮影アングルを登録
      // ==============================

      let addedAngleCount = 0;

      for (
        let i = 0;
        i < excelLocations.length;
        i++
      ) {
        const excelLocation =
          excelLocations[i];

        const savedLocation =
          locationResults[i];

        // 既存アングルを取得
        const {
          data: existingAngles,
          error: angleSelectError,
        } = await supabase
          .from("photo_angles")
          .select("*")
          .eq("location_id", savedLocation.id);

        if (angleSelectError) {
          console.error(angleSelectError);

          alert(
            "撮影アングルの取得に失敗しました。"
          );

          return;
        }

        for (const angleName of
          excelLocation.angles) {
          const alreadyExists =
            existingAngles.some(
              (angle) =>
                angle.angle_name ===
                angleName
            );

          if (!alreadyExists) {
            const {
              data: newAngle,
              error: angleInsertError,
            } = await supabase
              .from("photo_angles")
              .insert({
                location_id:
                  savedLocation.id,
                angle_name:
                  angleName,
              })
              .select()
              .single();

            if (angleInsertError) {
              console.error(
                angleInsertError
              );

              alert(
                "撮影アングルの保存に失敗しました。"
              );

              return;
            }

            addedAngleCount++;
          }
        }
      }

      // ==============================
      // 画面の撮影場所を更新
      // ==============================

      const convertedLocations =
        locationResults.map((item) => ({
          id: item.id,
          floor: item.floor || "",
          drawingNumber:
            item.drawing_number || "",
          roomNumber:
            item.room_number || "",
          roomName:
            item.room_name || "",
        }));

      setLocations(convertedLocations);

      alert(
        `${convertedLocations.length}件の撮影場所を確認し、${addedAngleCount}件の撮影アングルを登録しました。`
      );
    } catch (error) {
      console.error(error);

      alert(
        "Excelの読み込みに失敗しました。"
      );
    }
  };

  reader.readAsArrayBuffer(file);

  event.target.value = "";
};

  // 写真を圧縮する
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const img = new Image();

        img.onload = () => {
          const maxSize = 1800;

          let width = img.width;
          let height = img.height;

          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height / width) * maxSize;
              width = maxSize;
            } else {
              width = (width / height) * maxSize;
              height = maxSize;
            }
          }

          const canvas = document.createElement("canvas");

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");

          ctx.drawImage(
            img,
            0,
            0,
            width,
            height
          );

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(
                  new Error(
                    "画像の圧縮に失敗しました"
                  )
                );
                return;
              }

              resolve(blob);
            },
            "image/jpeg",
            0.75
          );
        };

        img.onerror = () => {
          reject(
            new Error(
              "画像の読み込みに失敗しました"
            )
          );
        };

        img.src = event.target.result;
      };

      reader.onerror = () => {
        reject(
          new Error(
            "ファイルの読み込みに失敗しました"
          )
        );
      };

      reader.readAsDataURL(file);
    });
  };


  // 写真を撮影・Supabaseへ保存
  const handlePhoto = async (event) => {
    const file = event.target.files[0];

    if (!file || !selectedLocation) {
      return;
    }

    if (!selectedAngle) {
      alert(
        "先に撮影アングルを選択してください。"
      );

      event.target.value = "";
      return;
    }

    try {
      setMessage(
        "写真を圧縮・保存しています..."
      );

      // 写真を圧縮
      const compressedBlob =
        await compressImage(file);

// 同じ撮影場所・同じアングルの写真枚数を確認
const sameAnglePhotos = photos.filter(
  (photo) =>
    photo.locationId === selectedLocation.id &&
    photo.angleId === selectedAngle.id
);

// 写真通番
const photoNumber = String(
  sameAnglePhotos.length + 1
).padStart(3, "0");

// ファイル名
const fileName =
  `${selectedLocation.floor || "階数不明"}_` +
  `${selectedLocation.roomName || "部屋名不明"}_` +
  `${selectedAngle.angleName || "アングル不明"}_` +
  `${photoNumber}.jpg`;


      // Storage上の保存場所
      const filePath =
        `${projectId}/${selectedLocation.id}/${selectedAngle.id}/${fileName}`;

      // Supabase Storageへアップロード
      const {
        error: uploadError,
      } = await supabase.storage
        .from("construction-photos")
        .upload(
          filePath,
          compressedBlob,
          {
            contentType: "image/jpeg",
            upsert: false,
          }
        );

      if (uploadError) {
  console.error(
    "写真のアップロードエラー:",
    uploadError
  );

  alert(
    "写真のアップロードに失敗しました。\n\n" +
    uploadError.message
  );

  setMessage("");
  return;
}

     // 写真URLを取得
const {
  data: signedUrlData,
  error: signedUrlError,
} = await supabase.storage
  .from("construction-photos")
  .createSignedUrl(
    filePath,
    3600
  );

if (signedUrlError) {
  console.error(
    "写真URLの取得エラー:",
    signedUrlError
  );

  alert(
    "写真URLの取得に失敗しました。\n\n" +
    signedUrlError.message
  );

  return;
}

const photoUrl =
  signedUrlData.signedUrl;

      // photosテーブルへ保存
      const {
        data: savedPhoto,
        error: photoInsertError,
      } = await supabase
        .from("photos")
        .insert({
          project_id: projectId,
          location_id:
            selectedLocation.id,
          angle_id:
            selectedAngle.id,
          file_path: filePath,
        })
        .select()
        .single();

      if (photoInsertError) {
        console.error(
          photoInsertError
        );

        alert(
          "写真情報の保存に失敗しました。"
        );

        return;
      }

      // 画面にも表示
      const newPhoto = {
        id: savedPhoto.id,
        url: photoUrl,
        locationId:
          selectedLocation.id,
        angleId:
          selectedAngle.id,
        location:
          selectedLocation,
        angle:
          selectedAngle,
        filePath:
          filePath,
      };

      setPhotos((prev) => [
        ...prev,
        newPhoto,
      ]);

      setMessage(
        "写真を保存しました。"
      );

    } catch (error) {
      console.error(error);

      alert(
        "写真の保存中にエラーが発生しました。"
      );

      setMessage("");
    }

    event.target.value = "";
  };


  // 撮影場所ごとの写真枚数
  const getPhotoCount = (locationId) => {
    return photos.filter(
      (photo) =>
        photo.locationId === locationId
    ).length;
  };

    // ログアウト
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error(
        "ログアウトエラー:",
        error
      );

      alert(
        "ログアウトに失敗しました。\n\n" +
        error.message
      );

      return;
    }

    setSession(null);
  };

// 写真を削除
const deletePhoto = async (photoId) => {
  const photo = photos.find(
    (photo) => photo.id === photoId
  );

  if (!photo) {
    alert("削除する写真が見つかりません。");
    return;
  }

  const confirmed = window.confirm(
    "この写真を削除しますか？\n\n削除すると元に戻せません。"
  );

  if (!confirmed) {
    return;
  }

  try {
    setMessage("写真を削除しています...");

    // ① photosテーブルから削除
    const {
      data: deletedPhoto,
      error: dbError,
    } = await supabase
      .from("photos")
      .delete()
      .eq("id", photoId)
      .select();

    if (dbError) {
      console.error(
        "写真情報の削除エラー:",
        dbError
      );

      alert(
        "写真情報の削除に失敗しました。\n\n" +
        dbError.message
      );

      setMessage("");
      return;
    }

    console.log(
      "DBから削除された写真:",
      deletedPhoto
    );

    // DBから実際に削除されたか確認
    if (
      !deletedPhoto ||
      deletedPhoto.length === 0
    ) {
      alert(
        "写真を削除できませんでした。\n\n" +
        "Supabaseの削除権限（RLS）の設定を確認する必要があります。"
      );

      setMessage("");
      return;
    }

    // ② Storageから画像を削除
    if (photo.filePath) {
      const {
        error: storageError,
      } = await supabase.storage
        .from("construction-photos")
        .remove([photo.filePath]);

      if (storageError) {
        console.error(
          "Storageの削除エラー:",
          storageError
        );

        alert(
          "写真情報は削除されましたが、画像ファイルの削除に失敗しました。\n\n" +
          storageError.message
        );

        setMessage("");
        return;
      }

      console.log(
        "Storageから削除しました:",
        photo.filePath
      );
    }

    // ③ 画面から削除
    setPhotos((prev) =>
      prev.filter(
        (photo) => photo.id !== photoId
      )
    );

    setMessage("写真を削除しました。");

  } catch (error) {
    console.error(
      "写真削除中のエラー:",
      error
    );

    alert(
      "写真の削除中にエラーが発生しました。\n\n" +
      error.message
    );

    setMessage("");
  }
};

  // ログイン確認中
  if (authLoading) {
    return (
      <div className="app">
        <main className="container">
          <section className="card">
            <h2>読み込み中...</h2>
          </section>
        </main>
      </div>
    );
  }

  // ログインしていない場合
  if (!session) {
    return <LoginScreen />;
  }

  return (
    <div className="app">

     <header className="header">

  <h1>📷 工事写真管理</h1>

  <p>
    工事写真を撮影場所ごとに管理します
  </p>

  <button
    onClick={handleLogout}
    style={{
      marginTop: "10px",
    }}
  >
    🚪 ログアウト
  </button>

</header>

      <main className="container">

        {/* 工事情報 */}
        <section className="card">

          <h2>工事情報</h2>

          <label>工事名</label>

          <input
            type="text"
            placeholder="例：○○マンション新築工事"
            value={projectName}
            onChange={(e) =>
              setProjectName(e.target.value)
            }
          />

          <button
            onClick={saveProject}
            style={{
              marginTop: "10px",
              width: "100%",
            }}
          >
            💾 工事名を保存
          </button>

          {message && (
            <p
              style={{
                color: "green",
                marginTop: "10px",
              }}
            >
              {message}
            </p>
          )}

        </section>

        {/* 撮影場所登録 */}
        <section className="card">

          <h2>撮影場所の登録</h2>

          <p className="description">
            手入力またはExcelから登録できます。
          </p>

          <h3>手入力</h3>

          <div className="add-location">

            <input
              type="text"
              placeholder="部屋名などを入力"
              value={newLocation}
              onChange={(e) =>
                setNewLocation(e.target.value)
              }
            />

            <button onClick={addLocation}>
              ＋ 追加
            </button>

          </div>

          <h3>Excelから一括登録</h3>

          <p className="description">
            「フロア」「図面番号」「部屋番号」
            「部屋名」の列を読み込みます。
          </p>

          <label className="excel-button">

            📊 Excelファイルを選択

            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              hidden
            />

          </label>

        </section>

        {/* 撮影場所一覧 */}
{!selectedLocation && (
<section className="card">

          <div className="section-title">

            <h2>撮影場所</h2>

            <span>
              {locations.length} 箱
            </span>

          </div>

          {locations.length === 0 ? (

            <div className="empty">
              まだ撮影場所がありません。
            </div>

          ) : (

            <div className="location-list">

              {locations.map(
                (location, index) => {

                  const photoCount =
                    getPhotoCount(
                      location.id
                    );

                  return (

                    <div
                      className="location-item"
                      key={location.id}
                    >

                      <div className="location-info">

                        <span className="number">
                          {String(
                            index + 1
                          ).padStart(2, "0")}
                        </span>

                        <div>

                          <div className="room-name">

                            {location.roomName ||
                              "部屋名未設定"}

                          </div>

                          <div className="room-detail">

                            フロア：
                            {location.floor || "-"}

                            <br />

                            図面番号：
                            {location.drawingNumber ||
                              "-"}

                            <br />

                            部屋番号：
                            {location.roomNumber ||
                              "-"}

                          </div>

                          <div className="photo-count">

                            📷 写真：
                            {photoCount} 枚

                          </div>

                        </div>

                      </div>


                      <div className="location-actions">

                        <button
                         className="camera-button"
                         onClick={() => {
                           setSelectedLocation(location);
                            setSelectedAngle(null);
                          }}
                        >
                          📁 開く
                        </button>

                        <button
                          className="delete-button"
                          onClick={() =>
                            deleteLocation(location.id)
                          }
                        >
                          削除
                        </button>

                      </div>

                    </div>

                  );
                }
              )}

            </div>

          )}

        </section>
)}

        {/* 撮影場所の中 */}
{selectedLocation && !selectedAngle && (
  <section className="card">
    <h2 style={{ color: "red" }}>
      ★ 撮影場所を開きました
    </h2>

    <button
      className="close-button"
      onClick={() => {
        setSelectedLocation(null);
        setSelectedAngle(null);
      }}
    >
      ← 撮影場所一覧に戻る
    </button>

    <h2>
      📁 {selectedLocation.roomName}
    </h2>

    <p>
      {selectedLocation.floor || "-"}　
      {selectedLocation.drawingNumber || "-"}　
      {selectedLocation.roomNumber || "-"}
    </p>

    <h3>
      撮影アングルを選択してください
    </h3>

    <div className="angle-list">

      {angles
        .filter(
          (angle) =>
            angle.locationId ===
            selectedLocation.id
        )
        .map((angle) => (
          <div
            className="angle-item"
            key={angle.id}
          >

            <span className="angle-name">
              📷 {angle.angleName}
            </span>

            <button
              className="camera-button"
              onClick={() =>
                setSelectedAngle(angle)
              }
            >
              選択
            </button>

          </div>
        ))}

    </div>

  </section>
)}

{/* アングル選択後・写真撮影 */}
{selectedLocation && selectedAngle && (
  <section className="card">

    <button
      className="close-button"
      onClick={() => {
        setSelectedAngle(null);
      }}
    >
      ← アングル選択に戻る
    </button>

    <h2>
      📷 写真撮影
    </h2>

    <h3>
      {selectedAngle.angleName}
    </h3>

    <p>
      撮影場所：{selectedLocation.roomName}
    </p>

    <label
      className="camera-button"
      style={{
        display: "block",
        textAlign: "center",
        padding: "20px",
        marginTop: "20px",
        cursor: "pointer",
        fontSize: "20px",
      }}
    >
      📷 写真を撮影

      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhoto}
        style={{ display: "none" }}
      />

    </label>

  </section>
)}

{/* 撮影済み写真 */}
<section className="card">

  <h2>📁 撮影場所の写真</h2>

  {!selectedLocation ? (

    <div className="empty">
      撮影場所を開くと、その場所の写真が表示されます。
    </div>

  ) : (

    <div>

      <div className="photo-box">

        <div className="photo-box-header">

          <div>

            <h3>
              📁 {selectedLocation.roomName || "部屋名未設定"}
            </h3>

            <p>
              {selectedLocation.floor || "-"}　
              {selectedLocation.drawingNumber || "-"}　
              {selectedLocation.roomNumber || "-"}
            </p>

          </div>

          <strong>
            📷{" "}
            {
              photos.filter(
                (photo) =>
                  photo.locationId === selectedLocation.id
              ).length
            }
            枚
          </strong>

        </div>

        {photos.filter(
          (photo) =>
            photo.locationId === selectedLocation.id
        ).length === 0 ? (

          <div className="empty-photo">
            まだ写真がありません
          </div>

        ) : (

          <div className="photo-grid">

{photos
  .filter(
    (photo) =>
      photo.locationId === selectedLocation.id
  )
  .map((photo) => (

    <div
      className="photo-item"
      key={photo.id}
      style={{
        position: "relative",
      }}
    >

      {/* アングル名 */}
      <div
        style={{
          position: "absolute",
          top: "5px",
          left: "5px",
          backgroundColor: "#1976d2",
          color: "white",
          padding: "4px 8px",
          borderRadius: "4px",
          fontSize: "12px",
          fontWeight: "bold",
          zIndex: 2,
        }}
      >
        {
          angles.find(
            (angle) =>
              angle.id === photo.angleId
          )?.angleName || "アングル未設定"
        }
      </div>

      {/* 写真 */}
      <img
        src={photo.url}
        alt={
          selectedLocation.roomName ||
          "工事写真"
        }
        style={{
          width: "100%",
          height: "auto",
          display: "block",
        }}
      />

      <button
        className="photo-delete"
        onClick={() =>
          deletePhoto(photo.id)
        }
      >
        写真を削除
      </button>

    </div>

  ))}

          </div>

        )}

      </div>

    </div>

  )}

</section>


      </main>

    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();

    setErrorMessage("");
    setLoading(true);

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      console.error("ログインエラー:", error);

      setErrorMessage(
        "メールアドレスまたはパスワードが正しくありません。"
      );

      setLoading(false);
      return;
    }

    setLoading(false);
  };

  return (
    <div className="app">

      <header className="header">
        <h1>📷 工事写真管理</h1>
        <p>ログインしてください</p>
      </header>

      <main className="container">

        <section className="card">

          <h2>ログイン</h2>

          <form onSubmit={handleLogin}>

            <label>メールアドレス</label>

            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              autoComplete="email"
              required
            />

            <label
              style={{
                display: "block",
                marginTop: "15px",
              }}
            >
              パスワード
            </label>

            <input
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              autoComplete="current-password"
              required
            />

            {errorMessage && (
              <p
                style={{
                  color: "red",
                  marginTop: "10px",
                }}
              >
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "20px",
                width: "100%",
              }}
            >
              {loading
                ? "ログインしています..."
                : "ログイン"}
            </button>

          </form>

        </section>

      </main>

    </div>
  );
}

export default App;