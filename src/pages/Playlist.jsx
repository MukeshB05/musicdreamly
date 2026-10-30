import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Navigator from "../components/Navigator";
import Footer from "../components/footer";
import { genreData } from "../genreData";
import { searchPlayListByQuery } from "../../fetch";
import he from "he";
import {
  MdOutlineKeyboardArrowLeft,
  MdOutlineKeyboardArrowRight,
} from "react-icons/md";

const GENRES = [
  "For You",
  "Tamil",
  "Malayalam",
  "Hindi",
  "English",
  "Kannada",
  "Telugu",
  "Marathi",
  "Gujarati",
  "Bengali",
  "Haryanvi",
  "Punjabi",
  "Rajasthani",
];

const FALLBACK_IMAGE = "/Unknown.png";

const getForYouPlaylists = () => {
  const list = genreData?.["For You"];
  return Array.isArray(list) ? list : [];
};

// --------------------------------------------------
// Get safe playlist image
// --------------------------------------------------
const getPlaylistImage = (playlist) => {
  if (!playlist) return FALLBACK_IMAGE;

  // JioSaavn format: image: [{ url }, { url }, { url }]
  if (Array.isArray(playlist.image)) {
    return (
      playlist.image?.[2]?.url ||
      playlist.image?.[1]?.url ||
      playlist.image?.[0]?.url ||
      FALLBACK_IMAGE
    );
  }

  if (typeof playlist.image === "string" && playlist.image) {
    return playlist.image;
  }

  return FALLBACK_IMAGE;
};

// --------------------------------------------------
// Decode playlist name safely
// --------------------------------------------------
const getPlaylistName = (playlist) => {
  if (!playlist?.name) return "Unknown Playlist";

  try {
    return he.decode(String(playlist.name));
  } catch (error) {
    console.error("Playlist name decode error:", error);
    return String(playlist.name);
  }
};

function Playlist() {
  const navigate = useNavigate();
  const scrollRef = useRef(null);

  // Incremented on every genre click so a slow, older response can never
  // overwrite the list of the genre the user selected last.
  const requestIdRef = useRef(0);

  const [selectedGenre, setSelectedGenre] = useState("For You");
  const [playlists, setPlaylists] = useState(getForYouPlaylists);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // --------------------------------------------------
  // Scroll controls (desktop slider only)
  // --------------------------------------------------
  const scrollByPage = (direction) => {
    const container = scrollRef.current;
    if (!container) return;

    container.scrollBy({
      left: direction * Math.max(container.clientWidth * 0.8, 240),
      behavior: "smooth",
    });
  };

  // --------------------------------------------------
  // Genre click
  // --------------------------------------------------
  const handleGenreClick = async (genre) => {
    const requestId = ++requestIdRef.current;

    setSelectedGenre(genre);
    setError("");

    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }

    // Local playlists for "For You"
    if (genre === "For You") {
      setLoading(false);
      setPlaylists(getForYouPlaylists());
      return;
    }

    try {
      setLoading(true);
      setPlaylists([]);

      const data = await searchPlayListByQuery(genre.toLowerCase(), 130);

      // A newer click happened while this request was running
      if (requestId !== requestIdRef.current) return;

      const results = data?.data?.results;

      if (Array.isArray(results) && results.length > 0) {
        setPlaylists(results);
      } else {
        setPlaylists([]);
        setError("No playlists found.");
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;

      console.error("Error fetching playlists:", err);
      setPlaylists([]);
      setError("Unable to load playlists. Please try again.");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  // --------------------------------------------------
  // Playlist click
  // --------------------------------------------------
  const handlePlaylistClick = (playlist) => {
    if (!playlist?.id) {
      console.error("Playlist ID is missing:", playlist);
      return;
    }

    navigate(`/playlists/${playlist.id}`);
  };

  const visiblePlaylists = playlists.filter((playlist) => playlist?.id);

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <>
      <Navbar />

      <main className="mt-[8.3rem] lg:mt-[6rem] mb-[12rem] lg:mb-[4rem]">
        {/* -------------------------------------------
            Genre navigation
            - phone: one scrolling row
            - tablet / desktop site (md+): wraps and centres
        -------------------------------------------- */}
        <div className="w-full">
          <ul
            className="
              flex
              items-center
              gap-2
              sm:gap-3
              px-4
              sm:px-5
              py-2
              overflow-x-auto
              scroll-smooth
              scroll-hide
              md:justify-center
              md:flex-wrap
              md:overflow-visible
            "
          >
            {GENRES.map((genre) => (
              <li key={genre} className="shrink-0">
                <button
                  type="button"
                  onClick={() => handleGenreClick(genre)}
                  aria-pressed={selectedGenre === genre}
                  className={`
                    flex
                    items-center
                    justify-center
                    whitespace-nowrap
                    cursor-pointer
                    select-none
                    font-semibold
                    border
                    border-zinc-700
                    text-center
                    px-4
                    sm:px-5
                    py-1
                    text-sm
                    sm:text-base
                    rounded-3xl
                    transition-all
                    duration-200
                    hover:scale-105
                    ${
                      selectedGenre === genre
                        ? "search-btn arrow-btnn"
                        : "navigator"
                    }
                  `}
                >
                  {genre}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* -------------------------------------------
            Playlist section
        -------------------------------------------- */}
        <section className="flex flex-col gap-5">
          <h2
            className="
              text-xl
              sm:text-2xl
              font-semibold
              ml-4
              sm:ml-6
              lg:ml-[4rem]
              mt-3
            "
          >
            • {selectedGenre}
          </h2>

          {/* Loading */}
          {loading && (
            <div className="flex justify-center items-center py-16">
              <div
                className="
                  w-10
                  h-10
                  border-4
                  border-zinc-600
                  border-t-transparent
                  rounded-full
                  animate-spin
                "
              />
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-12 px-5">
              <p className="text-red-400 text-center mb-4">{error}</p>

              <button
                type="button"
                onClick={() => handleGenreClick(selectedGenre)}
                className="
                  px-5
                  py-2
                  rounded-full
                  border
                  border-zinc-600
                  hover:bg-zinc-800
                  transition
                "
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && visiblePlaylists.length === 0 && (
            <div className="flex justify-center items-center py-16">
              <p className="text-zinc-400">No playlists available.</p>
            </div>
          )}

          {/* Playlist grid (phone / tablet / desktop site) + slider (large desktop) */}
          {!loading && !error && visiblePlaylists.length > 0 && (
            <div className="flex justify-center items-center w-full">
              {/* Left arrow (large desktop only) */}
              <button
                type="button"
                aria-label="Scroll playlists left"
                onClick={() => scrollByPage(-1)}
                className="
                  hidden
                  lg:flex
                  items-center
                  justify-center
                  shrink-0
                  text-3xl
                  w-[2rem]
                  h-[9rem]
                  cursor-pointer
                  arrow-btn
                  hover:scale-125
                  transition-all
                  duration-300
                  ease-in-out
                "
              >
                <MdOutlineKeyboardArrowLeft />
              </button>

              {/*
                Layout by screen width:
                - phone   (<640px):   2 columns, cards fill the column
                - tablet  (640-767):  3 columns
                - md      (768-1023): 4 columns (also "desktop site" on phones)
                - lg+     (>=1024):   2-row horizontal slider, 10rem cards
              */}
              <div
                ref={scrollRef}
                className="
                  grid
                  grid-cols-2
                  sm:grid-cols-3
                  md:grid-cols-4
                  lg:grid-cols-none
                  lg:grid-rows-2
                  lg:grid-flow-col
                  lg:auto-cols-[10rem]
                  gap-3
                  sm:gap-4
                  w-full
                  min-w-0
                  px-4
                  sm:px-6
                  lg:px-8
                  lg:overflow-x-auto
                  scroll-smooth
                  scroll-hide
                "
              >
                {visiblePlaylists.map((playlist, index) => {
                  const imageUrl = getPlaylistImage(playlist);
                  const playlistName = getPlaylistName(playlist);

                  return (
                    <button
                      key={`${playlist.id}-${index}`}
                      type="button"
                      onClick={() => handlePlaylistClick(playlist)}
                      className="
                        group
                        flex
                        flex-col
                        items-center
                        text-left
                        w-full
                        min-w-0
                        overflow-hidden
                        cursor-pointer
                        pt-1
                        pb-2
                        card
                        rounded-md
                        focus:outline-none
                        focus:ring-2
                        focus:ring-zinc-500
                      "
                    >
                      {/* Image: always square, scales with the card */}
                      <div className="w-full aspect-square p-2">
                        <img
                          src={imageUrl}
                          alt={playlistName}
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = FALLBACK_IMAGE;
                          }}
                          className="
                            w-full
                            h-full
                            object-cover
                            rounded-2xl
                            transition-all
                            duration-300
                            group-hover:brightness-[0.65]
                            group-hover:scale-[1.02]
                          "
                        />
                      </div>

                      {/* Name */}
                      <p
                        className="
                          w-full
                          text-center
                          text-[13px]
                          sm:text-[14px]
                          px-2
                          truncate
                        "
                        title={playlistName}
                      >
                        {playlistName}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Right arrow (large desktop only) */}
              <button
                type="button"
                aria-label="Scroll playlists right"
                onClick={() => scrollByPage(1)}
                className="
                  hidden
                  lg:flex
                  items-center
                  justify-center
                  shrink-0
                  text-3xl
                  w-[2rem]
                  h-[9rem]
                  cursor-pointer
                  arrow-btn
                  hover:scale-125
                  transition-all
                  duration-300
                  ease-in-out
                "
              >
                <MdOutlineKeyboardArrowRight />
              </button>
            </div>
          )}
        </section>
      </main>

      <Navigator />
    </>
  );
}

export default Playlist;
