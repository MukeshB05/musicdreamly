import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FaHeart, FaRegHeart } from "react-icons/fa6";
import { IoShareSocial } from "react-icons/io5";
import {
  MdOutlineKeyboardArrowLeft,
  MdOutlineKeyboardArrowRight,
} from "react-icons/md";

import Navbar from "../components/Navbar";
import SongsList from "../components/SongsList";
import Footer from "../components/footer";
import Navigator from "../components/Navigator";
import SongGrid from "../components/SongGrid";
import { fetchAlbumByID, getSuggestionSong } from "../../fetch";

const safeArray = (value) => (Array.isArray(value) ? value : []);

const unwrap = (response) => {
  let value = response;
  // APIs may wrap the actual object in data/result/payload more than once.
  for (let i = 0; i < 4; i += 1) {
    if (!value || typeof value !== "object" || Array.isArray(value)) break;
    if (value.album && typeof value.album === "object") {
      value = value.album;
      continue;
    }
    if (value.data && typeof value.data === "object") {
      value = value.data;
      continue;
    }
    if (value.result && typeof value.result === "object") {
      value = value.result;
      continue;
    }
    if (value.payload && typeof value.payload === "object") {
      value = value.payload;
      continue;
    }
    break;
  }
  return value;
};

const imageUrl = (image) => {
  if (!image) return "/Unknown.png";
  if (typeof image === "string") return image;
  if (Array.isArray(image)) {
    const preferred = [...image].reverse().find((item) =>
      typeof item === "string" ? item : item?.url || item?.link || item?.src
    );
    return typeof preferred === "string"
      ? preferred
      : preferred?.url || preferred?.link || preferred?.src || "/Unknown.png";
  }
  return image?.url || image?.link || image?.src || "/Unknown.png";
};

const artistList = (artists) => {
  if (Array.isArray(artists?.primary) && artists.primary.length) return artists.primary;
  if (Array.isArray(artists?.all) && artists.all.length) return artists.all;
  if (Array.isArray(artists)) return artists;
  if (artists?.name) return [artists];
  return [];
};

const getSongList = (album) => {
  const candidates = [album?.songs, album?.tracks, album?.song, album?.data?.songs, album?.data?.tracks];
  return candidates.find(Array.isArray) || [];
};

const readLikedAlbums = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem("likedAlbums") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const AlbumDetail = () => {
  const { id } = useParams();
  const [album, setAlbum] = useState(null);
  const [songs, setSongs] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [likedAlbums, setLikedAlbums] = useState(readLikedAlbums);
  const scrollRef = useRef(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      setAlbum(null);
      setSongs([]);
      setSuggestions([]);

      if (!id) {
        setError("Album ID is missing from the URL.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetchAlbumByID(id);
        const data = unwrap(response);
        if (!data || typeof data !== "object" || (!data.id && !data.name && !data.title)) {
          throw new Error("The API returned album data in an unsupported format.");
        }

        const albumSongs = getSongList(data);
        if (!active) return;
        setAlbum({ ...data, songs: albumSongs });
        setSongs(albumSongs);

        // Suggestions are optional. An error here must not break the album page.
        const firstSongId = albumSongs[0]?.id || albumSongs[0]?.songId || albumSongs[0]?.song_id;
        if (firstSongId) {
          try {
            const suggestionResponse = await getSuggestionSong(firstSongId);
            const suggestionData = unwrap(suggestionResponse);
            const list = Array.isArray(suggestionData)
              ? suggestionData
              : safeArray(suggestionData?.songs || suggestionData?.results || suggestionData?.items);
            const albumIds = new Set(albumSongs.map((song) => String(song?.id ?? song?.songId ?? "")));
            if (active) {
              setSuggestions(list.filter((song) => {
                const songId = song?.id ?? song?.songId ?? song?.song_id;
                return songId != null && !albumIds.has(String(songId));
              }));
            }
          } catch (suggestionError) {
            console.warn("Album suggestions unavailable:", suggestionError);
          }
        }
      } catch (fetchError) {
        console.error("Unable to load album:", fetchError);
        if (active) setError(fetchError?.message || "Unable to load this album. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [id]);

  const albumId = String(album?.id ?? album?.albumId ?? id ?? "");
  const liked = likedAlbums.some((item) => String(item?.id ?? item?.albumId ?? "") === albumId);
  const artists = useMemo(() => artistList(album?.artists || album?.artist), [album]);
  const primaryArtist = artists[0];
  const cover = imageUrl(album?.image || album?.images || album?.artwork);
  const albumName = album?.name || album?.title || "Unknown Album";

  const toggleLikeAlbum = useCallback(() => {
    if (!album) return;
    const current = readLikedAlbums();
    const isLiked = current.some((item) => String(item?.id ?? item?.albumId ?? "") === albumId);
    const updated = isLiked
      ? current.filter((item) => String(item?.id ?? item?.albumId ?? "") !== albumId)
      : [...current, {
          id: album.id ?? album.albumId ?? id,
          name: albumName,
          image: cover,
          artists: album.artists || album.artist || artists,
        }];
    localStorage.setItem("likedAlbums", JSON.stringify(updated));
    setLikedAlbums(updated);
    window.dispatchEvent(new Event("favouritesUpdated"));
  }, [album, albumId, albumName, artists, cover, id]);

  const shareAlbum = async () => {
    const url = `${window.location.origin}/albums/${encodeURIComponent(id || albumId)}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: albumName, text: `Listen to ${albumName}`, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        window.alert("Album link copied.");
      } else {
        window.prompt("Copy this album link:", url);
      }
    } catch (shareError) {
      if (shareError?.name !== "AbortError") console.error("Album share failed:", shareError);
    }
  };

  const scroll = (amount) => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  if (loading) {
    return <div className="flex min-h-screen w-full items-center justify-center"><img src="/Loading.gif" alt="Loading album…" /></div>;
  }

  if (error || !album) {
    return (
      <>
        <Navbar />
        <main className="flex min-h-[65vh] flex-col items-center justify-center gap-4 px-5 pt-28 text-center">
          <h1 className="text-2xl font-semibold">Album unavailable</h1>
          <p className="max-w-xl opacity-75">{error || "We couldn't find this album."}</p>
          <button type="button" onClick={() => window.location.reload()} className="rounded-full border px-5 py-2">Try again</button>
          <Link to="/" className="underline">Back to Home</Link>
        </main>
        <Navigator />
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex flex-col gap-8 px-3 pb-24 pt-28 lg:gap-10 lg:px-8 lg:pt-24">
        <section className="flex items-center gap-4 sm:gap-7">
          <img
            src={cover}
            alt={albumName}
            onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/Unknown.png"; }}
            className="h-28 w-28 shrink-0 rounded-xl object-cover shadow-xl sm:h-52 sm:w-52"
          />
          <div className="min-w-0">
            <p className="mb-1 text-xs uppercase tracking-wider opacity-70">Album</p>
            <h1 className="break-words text-xl font-bold sm:text-3xl">{albumName}</h1>
            <p className="mt-2 text-sm opacity-80 sm:text-base">
              {album.songCount ?? songs.length} songs
              {primaryArtist?.name && <> · <Link className="hover:underline" to={primaryArtist.id ? `/artists/${primaryArtist.id}` : "#"}>{primaryArtist.name}</Link></>}
              {album.year ? ` · ${album.year}` : ""}
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={toggleLikeAlbum} title={liked ? "Remove from favourites" : "Add to favourites"} aria-label={liked ? "Unlike album" : "Like album"} className="flex h-11 w-11 items-center justify-center rounded-full border border-current/20">
                {liked ? <FaHeart className="text-xl text-red-500" /> : <FaRegHeart className="icon text-xl" />}
              </button>
              <button type="button" onClick={shareAlbum} title="Share album" aria-label="Share album" className="flex h-11 w-11 items-center justify-center rounded-full border border-current/20">
                <IoShareSocial className="icon text-xl" />
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 px-1 text-lg font-semibold sm:text-xl">Songs</h2>
          {songs.length ? (
            <div className="flex max-h-[65vh] flex-col gap-1 overflow-y-auto scroll-smooth scroll-hide">
              {songs.map((song, index) => <SongsList key={song?.id || song?.songId || `${albumId}-${index}`} {...song} song={songs} />)}
            </div>
          ) : (
            <p className="rounded-xl border border-current/10 p-5 opacity-75">No songs were returned for this album.</p>
          )}
        </section>

        {suggestions.length > 0 && (
          <section className="mb-6 w-full">
            <h2 className="mb-4 text-xl font-semibold">You Might Like</h2>
            <div className="flex w-full items-center gap-2">
              <button type="button" aria-label="Scroll recommendations left" onClick={() => scroll(-700)} className="hidden h-24 shrink-0 items-center justify-center lg:flex"><MdOutlineKeyboardArrowLeft className="text-3xl" /></button>
              <div ref={scrollRef} className="grid w-full grid-flow-col grid-rows-1 items-center justify-start gap-3 overflow-x-auto scroll-smooth scroll-hide">
                {suggestions.map((song, index) => <SongGrid key={song?.id || song?.songId || index} {...song} song={suggestions} />)}
              </div>
              <button type="button" aria-label="Scroll recommendations right" onClick={() => scroll(700)} className="hidden h-24 shrink-0 items-center justify-center lg:flex"><MdOutlineKeyboardArrowRight className="text-3xl" /></button>
            </div>
          </section>
        )}
      </main>
      <Navigator />
      <Footer />
    </>
  );
};

export default AlbumDetail;
