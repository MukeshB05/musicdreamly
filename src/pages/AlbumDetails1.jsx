import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import SongsList from "../components/SongsList";
import {
  fetchAlbumByID,
  getSuggestionSong,
  getSongRecommendations,
} from "../../fetch";
import Footer from "../components/footer";
import Navigator from "../components/Navigator";
import SongGrid from "../components/SongGrid";
import { FaHeart, FaRegHeart } from "react-icons/fa6";
import {
  MdOutlineKeyboardArrowLeft,
  MdOutlineKeyboardArrowRight,
} from "react-icons/md";
import { IoShareSocial } from "react-icons/io5";

const FALLBACK_IMAGE = "/Unknown.png";

// Last (largest) usable image url from a JioSaavn image array / string
const getImageUrl = (image) => {
  if (!image) return FALLBACK_IMAGE;
  if (typeof image === "string") return image;

  if (Array.isArray(image)) {
    for (let i = image.length - 1; i >= 0; i -= 1) {
      const url = image[i]?.url || image[i]?.link || image[i];
      if (typeof url === "string" && url) return url;
    }
  }

  return image?.url || FALLBACK_IMAGE;
};

const readLikedAlbums = () => {
  try {
    const stored = JSON.parse(localStorage.getItem("likedAlbums"));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
};

// API answers { success, data: [...] } (or { data: { songs: [...] } })
const toSongArray = (response) => {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.songs)) return data.songs;
  if (Array.isArray(response)) return response;
  return [];
};

const AlbumDetail = () => {
  const { id } = useParams();
  const scrollRef = useRef(null);

  const [details, setDetails] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [likedAlbums, setLikedAlbums] = useState(readLikedAlbums);

  const scrollByPage = (direction) => {
    const container = scrollRef.current;
    if (!container) return;

    container.scrollBy({
      left: direction * Math.max(container.clientWidth * 0.8, 240),
      behavior: "smooth",
    });
  };

  useEffect(() => {
    let cancelled = false;

    // Reset everything when the album id changes
    setLoading(true);
    setError(null);
    setDetails(null);
    setList([]);
    setSuggestions([]);

    const load = async () => {
      let albumSongs = [];

      // 1) The album itself. Only THIS can put the page into the error state.
      try {
        const data = await fetchAlbumByID(id);
        if (cancelled) return;

        if (!data?.data) throw new Error("Album not found");

        albumSongs = Array.isArray(data.data.songs) ? data.data.songs : [];

        setDetails(data);
        setList(albumSongs);
      } catch (err) {
        if (cancelled) return;
        console.error("Album fetch failed:", err);
        setError("Error fetching album details");
        return;
      } finally {
        if (!cancelled) setLoading(false);
      }

      // 2) "You Might Like" is optional: any failure here must never break the page.
      const seedId = albumSongs[0]?.id;
      if (!seedId) return;

      const sources = [
        () => getSuggestionSong(seedId, 20),
        () => getSongRecommendations(seedId),
      ];

      const albumIds = new Set(albumSongs.map((song) => song?.id));

      for (const loadSource of sources) {
        let songs = [];

        try {
          songs = toSongArray(await loadSource());
        } catch (err) {
          console.warn("Suggestion source unavailable:", err);
        }

        if (cancelled) return;

        // Remove songs already in the album, and duplicates
        const seen = new Set();
        const filtered = songs.filter((song) => {
          if (!song?.id || albumIds.has(song.id) || seen.has(song.id)) {
            return false;
          }
          seen.add(song.id);
          return true;
        });

        if (filtered.length > 0) {
          setSuggestions(filtered);
          return;
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen justify-center items-center">
        <img src="/Loading.gif" alt="Loading" />
      </div>
    );
  }

  if (error || !details?.data) {
    return (
      <div className="flex h-screen w-screen justify-center items-center">
        {error || "Album not found"}
      </div>
    );
  }

  const album = details.data;
  const albumImage = getImageUrl(album.image);
  const primaryArtist = album.artists?.primary?.[0];
  const isLiked = likedAlbums.some((item) => item.id === album.id);

  const toggleLikeAlbum = () => {
    const current = readLikedAlbums();

    const next = current.some((item) => item.id === album.id)
      ? current.filter((item) => item.id !== album.id)
      : [
          ...current,
          {
            id: album.id,
            name: album.name,
            image: albumImage,
            artists: album.artists,
          },
        ];

    setLikedAlbums(next);

    try {
      localStorage.setItem("likedAlbums", JSON.stringify(next));
    } catch (err) {
      console.error("Could not save liked albums:", err);
    }
  };

  const shareAlbum = async () => {
    const url = `${window.location.origin}/albums/${id}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: album.name,
          text: "Listen on Mukesh Music 4u",
          url,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        alert("Album link copied");
      }
    } catch (err) {
      // User closing the share sheet is not an error
      if (err?.name !== "AbortError") console.error("Share failed:", err);
    }
  };

  return (
    <>
      <Navbar />

      <div className="flex flex-col gap-[2rem] pt-[10rem] lg:pt-[6rem]">
        {/* Album header */}
        <div className="flex items-center pl-4 sm:pl-[2rem]">
          <img
            src={albumImage}
            alt={album.name || "Album"}
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = FALLBACK_IMAGE;
            }}
            className="h-[8rem] w-[8rem] lg:h-[15rem] lg:w-[15rem] lg:rounded rounded-full object-cover shadow-2xl shadow-zinc-600 shrink-0"
          />

          <div className="flex flex-col pl-4 sm:pl-[2rem] min-w-0">
            <div>
              <h2 className="text-xl lg:text-2xl font-medium lg:font-semibold">
                {album.name}
              </h2>
              <p className="font-sans font-semibold text-sm lg:text-lg">
                {album.songCount ?? list.length} Songs
                {primaryArtist?.name && (
                  <>
                    {" "}by{" "}
                    {primaryArtist.id ? (
                      <Link
                        to={`/artists/${primaryArtist.id}`}
                        className="hover:underline"
                      >
                        {primaryArtist.name}
                      </Link>
                    ) : (
                      primaryArtist.name
                    )}
                  </>
                )}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={toggleLikeAlbum}
                title="Like Album"
                aria-label="Like album"
                className="border-[1px] mt-3 border-[#8f8f8f6e] h-[3rem] w-[3rem] flex justify-center items-center rounded-full"
              >
                {isLiked ? (
                  <FaHeart className="text-red-500 text-2xl" />
                ) : (
                  <FaRegHeart className="text-2xl icon" />
                )}
              </button>

              <button
                type="button"
                onClick={shareAlbum}
                title="Share"
                aria-label="Share album"
                className="border-[1px] mt-3 border-[#8f8f8f6e] flex justify-center items-center h-[3rem] w-[3rem] rounded-full"
              >
                <IoShareSocial className="icon text-[1.8rem] mr-[0.1rem]" />
              </button>
            </div>
          </div>
        </div>

        {/* Album songs */}
        <div className="flex flex-col h-auto gap-4">
          <div className="overflow-y-scroll scroll-smooth scroll-hide pt-3">
            {list.map((song) => (
              <SongsList key={song.id} {...song} song={list} />
            ))}
          </div>
        </div>

        {/* You Might Like (only when there is something to show) */}
        {suggestions.length > 0 && (
          <div className="flex flex-col items-center w-full mb-[5rem]">
            <h2 className="w-full px-4 sm:px-6 lg:px-[4rem] my-4 text-xl sm:text-2xl font-semibold">
              You Might Like
            </h2>

            <div className="flex justify-center items-center gap-3 w-full">
              <button
                type="button"
                aria-label="Scroll suggestions left"
                onClick={() => scrollByPage(-1)}
                className="hidden lg:flex items-center text-3xl hover:scale-125 transition-all duration-200 ease-in-out cursor-pointer h-[9rem] arrow-btn"
              >
                <MdOutlineKeyboardArrowLeft />
              </button>

              <div
                ref={scrollRef}
                className="grid grid-rows-1 grid-flow-col justify-start overflow-x-auto scroll-hide items-center gap-3 lg:gap-2 w-full min-w-0 px-4 lg:px-0 scroll-smooth"
              >
                {suggestions.map((song, index) => (
                  <SongGrid
                    key={`${song.id}-${index}`}
                    {...song}
                    song={song}
                    songs={suggestions}
                  />
                ))}
              </div>

              <button
                type="button"
                aria-label="Scroll suggestions right"
                onClick={() => scrollByPage(1)}
                className="hidden lg:flex items-center text-3xl hover:scale-125 transition-all duration-200 ease-in-out cursor-pointer h-[9rem] arrow-btn"
              >
                <MdOutlineKeyboardArrowRight />
              </button>
            </div>
          </div>
        )}
      </div>

      <Navigator />
      <Footer />
    </>
  );
};

export default AlbumDetail;
