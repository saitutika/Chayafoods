import { useEffect, useState } from "react";
import {
  APIProvider,
  AdvancedMarker,
  Map,
  Pin,
} from "@vis.gl/react-google-maps";
import {
  Activity,
  ArrowUpRight,
  ChefHat,
  CircleCheck,
  Clock3,
  CreditCard,
  Crosshair,
  ExternalLink,
  LocateFixed,
  LockKeyhole,
  Heart,
  HelpCircle,
  MessageCircle,
  MapPin,
  Navigation,
  PackageCheck,
  Radio,
  Send,
  ShieldCheck,
  ShoppingBag,
  Star,
  Smartphone,
  Truck,
  UserRound,
  Wifi,
  WifiOff,
  WalletCards,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";
const statusOrder = [
  "ORDER_INITIALIZED",
  "ORDER_ACCEPTED",
  "FOOD_PREPARING",
  "AGENT_ASSIGNED",
  "AGENT_EN_ROUTE_TO_RESTAURANT",
  "AGENT_ARRIVED_AT_RESTAURANT",
  "ORDER_PICKED_UP",
  "AGENT_EN_ROUTE_TO_CUSTOMER",
  "AGENT_ARRIVED_AT_CUSTOMER",
  "ORDER_DELIVERED",
];

const statusLabels = {
  ORDER_INITIALIZED: "Order initialized",
  ORDER_ACCEPTED: "Accepted by restaurant",
  FOOD_PREPARING: "Kitchen preparing",
  AGENT_ASSIGNED: "Driver assigned",
  AGENT_EN_ROUTE_TO_RESTAURANT: "Driver en route to pickup",
  AGENT_ARRIVED_AT_RESTAURANT: "Driver at restaurant",
  ORDER_PICKED_UP: "Order picked up",
  AGENT_EN_ROUTE_TO_CUSTOMER: "Heading to customer",
  AGENT_ARRIVED_AT_CUSTOMER: "At delivery address",
  ORDER_DELIVERED: "Delivered",
};

const emptyOrder = null;
const emptyForm = {
  customer_id: "",
  restaurant_id: "",
  agent_id: "",
  customer_lat: "",
  customer_lng: "",
  restaurant_lat: "",
  restaurant_lng: "",
  destination_lat: "",
  destination_lng: "",
  total_amount: "",
};
const mapsAPIKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const mapsMapID = import.meta.env.VITE_GOOGLE_MAP_ID;
const defaultDeliveryLocation = { lat: 17.385, lng: 78.4867 };

const restaurants = [
  {
    id: "urban-bites",
    restaurantId: 1,
    name: "Urban Bites",
    cuisine: "Burgers, American",
    categories: ["Burgers", "Fast food"],
    rating: "4.7",
    time: "25-30 min",
    address: "12 Jubilee Hills Road, Hyderabad",
    price: "₹₹",
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=85",
    dish: "Smash burger & fries",
  },
  {
    id: "spice-route",
    restaurantId: 2,
    name: "Spice Route",
    cuisine: "North Indian, Biryani",
    categories: ["Indian", "Biryani"],
    rating: "4.8",
    time: "30-35 min",
    address: "8 Banjara Hills, Hyderabad",
    price: "₹₹",
    image:
      "https://images.unsplash.com/photo-1563379091339-03246963d96c?auto=format&fit=crop&w=900&q=85",
    dish: "Royal chicken biryani",
  },
  {
    id: "miso-house",
    name: "Miso House",
    cuisine: "Asian, Japanese",
    categories: ["Asian", "Healthy"],
    rating: "4.6",
    time: "35-40 min",
    address: "Film Nagar Main Road, Hyderabad",
    price: "₹₹₹",
    image:
      "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=85",
    dish: "Tonkotsu ramen bowl",
  },
  {
    id: "green-table",
    name: "Green Table",
    cuisine: "Salads, Healthy",
    categories: ["Healthy", "Vegetarian"],
    rating: "4.5",
    time: "20-25 min",
    address: "Kavuri Hills, Madhapur, Hyderabad",
    price: "₹₹",
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eebe?auto=format&fit=crop&w=900&q=85",
    dish: "Garden grain bowl",
  },
  {
    id: "la-pino-kitchen",
    name: "La Pino Kitchen",
    cuisine: "Pizza, Italian",
    categories: ["Pizza", "Italian"],
    rating: "4.4",
    time: "25-30 min",
    address: "Madhapur Metro Lane, Hyderabad",
    price: "₹₹",
    image:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=85",
    dish: "Truffle mushroom pizza",
  },
  {
    id: "roll-company",
    name: "The Roll Company",
    cuisine: "Wraps, Street food",
    categories: ["Wraps", "Fast food"],
    rating: "4.3",
    time: "20-25 min",
    address: "Hitech City Road, Hyderabad",
    price: "₹",
    image:
      "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=900&q=85",
    dish: "Tandoori paneer wrap",
  },
  {
    id: "sugar-cloud",
    name: "Sugar Cloud",
    cuisine: "Desserts, Bakery",
    categories: ["Desserts", "Bakery"],
    rating: "4.9",
    time: "25-30 min",
    address: "Road No. 36, Jubilee Hills, Hyderabad",
    price: "₹₹",
    image:
      "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=85",
    dish: "Warm chocolate dessert",
  },
  {
    id: "coastal-curry",
    name: "Coastal Curry",
    cuisine: "South Indian, Seafood",
    categories: ["Indian", "Seafood"],
    rating: "4.6",
    time: "35-40 min",
    address: "Kondapur Central, Hyderabad",
    price: "₹₹₹",
    image:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=85",
    dish: "Andhra thali special",
  },
];

function TrackingMap({ order, driverPosition }) {
  if (!mapsAPIKey || !mapsMapID) {
    return (
      <div className="map-setup">
        <MapPin size={24} />
        <strong>Google Maps is not configured</strong>
        <span>
          Set VITE_GOOGLE_MAPS_API_KEY and VITE_GOOGLE_MAP_ID in
          frontend/.env.local, then restart Vite.
        </span>
      </div>
    );
  }
  if (!order)
    return (
      <div className="map-setup">
        <MapPin size={24} />
        <strong>No active order</strong>
        <span>Create or select an order to load its route.</span>
      </div>
    );

  const restaurant = { lat: order.restaurant_lat, lng: order.restaurant_lng };
  const destination = {
    lat: order.destination_lat,
    lng: order.destination_lng,
  };
  return (
    <APIProvider apiKey={mapsAPIKey}>
      <Map
        defaultCenter={destination}
        defaultZoom={14}
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapId={mapsMapID}
      >
        <AdvancedMarker position={restaurant} title="Restaurant">
          <Pin background="#ffb36b" glyphColor="#18201d" />
        </AdvancedMarker>
        <AdvancedMarker position={destination} title="Customer destination">
          <Pin background="#91c9ff" glyphColor="#18201d" />
        </AdvancedMarker>
        {driverPosition && (
          <AdvancedMarker
            position={driverPosition}
            title="Driver live location"
          >
            <Pin background="#d5fa79" glyphColor="#18201d" />
          </AdvancedMarker>
        )}
      </Map>
    </APIProvider>
  );
}

function PaymentLocationPicker({ location, onLocationChange }) {
  if (!mapsAPIKey || !mapsMapID) {
    return (
      <div className="map-setup payment-map-setup">
        <MapPin size={24} />
        <strong>Google Maps is not configured</strong>
        <span>
          Add your Google Maps key and map ID to enable precise pin placement.
        </span>
      </div>
    );
  }
  return (
    <APIProvider apiKey={mapsAPIKey}>
      <Map
        defaultCenter={location || defaultDeliveryLocation}
        defaultZoom={14}
        gestureHandling="greedy"
        mapId={mapsMapID}
        onClick={(event) => {
          if (event.detail.latLng)
            onLocationChange({
              lat: event.detail.latLng.lat,
              lng: event.detail.latLng.lng,
            });
        }}
      >
        {location && (
          <AdvancedMarker position={location} title="Delivery location">
            <Pin background="#ff642f" glyphColor="#ffffff" />
          </AdvancedMarker>
        )}
      </Map>
    </APIProvider>
  );
}

function App() {
  const [page, setPage] = useState(() =>
    ["orders", "restaurant", "agent", "login", "payment", "profile"].includes(
      window.location.hash.replace("#", ""),
    )
      ? window.location.hash.replace("#", "")
      : "home",
  );
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const [favoriteRestaurants, setFavoriteRestaurants] = useState(() =>
    JSON.parse(localStorage.getItem("plate_favorites") || "[]"),
  );
  const [assistantPreference, setAssistantPreference] = useState("");
  const [assistantReply, setAssistantReply] = useState("");
  const [order, setOrder] = useState(emptyOrder);
  const [orders, setOrders] = useState([]);
  const [socketState, setSocketState] = useState("offline");
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [location, setLocation] = useState(null);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsStatus, setGpsStatus] = useState("Device GPS off");
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [menuItems, setMenuItems] = useState([]);
  const [session, setSession] = useState(() =>
    JSON.parse(localStorage.getItem("plate_session") || "null"),
  );
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [menuForm, setMenuForm] = useState({
    name: "",
    description: "",
    category: "Burgers",
    price: "",
    image_url: "",
  });
  const [agentOrders, setAgentOrders] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    cardName: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
    address: "",
  });
  const [addressFields, setAddressFields] = useState({
    house: "",
    street: "",
    city: "",
    state: "",
    postalCode: "",
    landmark: "",
  });
  const [deliveryLocation, setDeliveryLocation] = useState(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [cart, setCart] = useState({});

  useEffect(() => {
    const onHashChange = () => {
      const nextPage = window.location.hash.replace("#", "");
      setPage(
        [
          "orders",
          "restaurant",
          "agent",
          "login",
          "payment",
          "profile",
        ].includes(nextPage)
          ? nextPage
          : "home",
      );
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!session?.token || page !== "profile") return;
    fetch(`${API_BASE}/auth/profile`, { headers: authHeaders() })
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error("Could not load profile.")),
      )
      .then((profile) =>
        setProfileForm({
          name: profile.name || "",
          email: profile.email || "",
          phone: profile.phone || "",
          address: profile.address || "",
          city: profile.city || "",
          state: profile.state || "",
          postal_code: profile.postal_code || "",
        }),
      )
      .catch((requestError) => setError(requestError.message));
  }, [page, session?.token]);

  useEffect(() => {
    const redirectUnauthenticatedCheckout = (event) => {
      const checkoutButton = event.target.closest(".cart-checkout");
      if (checkoutButton) {
        event.preventDefault();
        event.stopPropagation();
        window.location.hash = session ? "payment" : "login";
      }
    };
    document.addEventListener("click", redirectUnauthenticatedCheckout, true);
    return () =>
      document.removeEventListener(
        "click",
        redirectUnauthenticatedCheckout,
        true,
      );
  }, [session]);

  useEffect(() => {
    if (!session || session.role !== "customer") {
      setOrders([]);
      setOrder(null);
      return undefined;
    }
    fetch(`${API_BASE}/orders`, { headers: authHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load orders.");
        return response.json();
      })
      .then((orders) => {
        setOrders(orders);
        if (orders.length > 0) setOrder(orders[0]);
      })
      .catch((requestError) => setError(requestError.message));
  }, [session?.token]);

  useEffect(() => {
    fetch(`${API_BASE}/menu-items`)
      .then((response) => (response.ok ? response.json() : []))
      .then(setMenuItems)
      .catch(() => setMenuItems([]));
  }, []);

  useEffect(() => {
    if (session?.role !== "driver") return undefined;
    fetch(`${API_BASE}/agents/${session.id}/orders`, { headers: authHeaders() })
      .then((response) => (response.ok ? response.json() : []))
      .then(setAgentOrders)
      .catch(() => setAgentOrders([]));
    return undefined;
  }, [session]);

  useEffect(() => {
    if (!order?.id) return undefined;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.host || "localhost:5173";
    const socketURL = API_BASE
      ? `${API_BASE.replace(/^http/, "ws")}/ws/track/orders/${order.id}`
      : `${protocol}://${host}/ws/track/orders/${order.id}`;
    const socket = new WebSocket(socketURL);
    socket.onopen = () => setSocketState("live");
    socket.onclose = () => setSocketState("offline");
    socket.onerror = () => setSocketState("error");
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setOrder((current) => ({ ...current, ...payload }));
        if (payload.driver_location) setLocation(payload.driver_location);
        setLastUpdate(new Date());
      } catch {
        setError("Received an invalid tracking event.");
      }
    };
    return () => socket.close();
  }, [order?.id]);

  useEffect(() => {
    if (!gpsEnabled || !order?.id || !order.agent_id) return undefined;
    if (!navigator.geolocation) {
      setGpsStatus("Geolocation unavailable");
      setGpsEnabled(false);
      return undefined;
    }

    setGpsStatus("Requesting device permission...");
    const watchID = navigator.geolocation.watchPosition(
      async (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLocation(nextLocation);
        setGpsStatus(`GPS accuracy ±${Math.round(position.coords.accuracy)}m`);
        try {
          const response = await fetch(`${API_BASE}/driver/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agent_id: order.agent_id,
              order_id: order.id,
              latitude: nextLocation.lat,
              longitude: nextLocation.lng,
            }),
          });
          if (!response.ok) throw new Error("GPS broadcast failed");
          setLastUpdate(new Date());
        } catch (requestError) {
          setError(requestError.message);
        }
      },
      (positionError) => {
        setGpsStatus(positionError.message || "GPS permission denied");
        setGpsEnabled(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watchID);
  }, [gpsEnabled, order?.id, order?.agent_id]);

  const currentIndex = order ? statusOrder.indexOf(order.status) : -1;
  const nextStatus = statusOrder[currentIndex + 1];
  const progress = order
    ? Math.max(
        0,
        Math.min(100, (currentIndex / (statusOrder.length - 1)) * 100),
      )
    : 0;
  const orderShortID = order?.id ? order.id.slice(0, 8).toUpperCase() : "—";
  const mapCenter = order
    ? { lat: order.destination_lat, lng: order.destination_lng }
    : undefined;
  const driverPosition =
    location ||
    (order?.restaurant_lat
      ? { lat: order.restaurant_lat, lng: order.restaurant_lng }
      : undefined);
  const categories = [
    "All",
    "Pizza",
    "Burgers",
    "Indian",
    "Asian",
    "Wraps",
    "Healthy",
    "Desserts",
  ];
  const visibleRestaurants = restaurants.filter((restaurant) => {
    const matchesCategory =
      selectedCategory === "All" ||
      restaurant.categories.includes(selectedCategory);
    const searchable =
      `${restaurant.name} ${restaurant.cuisine} ${restaurant.address} ${restaurant.dish}`.toLowerCase();
    return matchesCategory && searchable.includes(searchTerm.toLowerCase());
  });
  const selectedMenuItems = selectedRestaurant
    ? menuItems.filter(
        (item) => item.restaurant_id === selectedRestaurant.restaurantId,
      )
    : [];
  const cartItems = Object.values(cart);
  const cartTotal = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  async function login(event) {
    event.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      if (!response.ok)
        throw new Error((await response.json()).error || "Login failed");
      const user = await response.json();
      const nextSession = { token: user.token, ...user.user };
      localStorage.setItem("plate_session", JSON.stringify(nextSession));
      setSession(nextSession);
      window.location.hash =
        user.role === "restaurant"
          ? "restaurant"
          : user.role === "driver"
            ? "agent"
            : "orders";
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function publishMenuItem(event) {
    event.preventDefault();
    if (!session?.restaurant_id) return;
    try {
      const response = await fetch(
        `${API_BASE}/restaurants/${session.restaurant_id}/menu-items`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            ...menuForm,
            restaurant_id: session.restaurant_id,
            price: Number(menuForm.price),
          }),
        },
      );
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Could not publish menu item",
        );
      const created = await response.json();
      setMenuItems((current) => [created, ...current]);
      setMenuForm({
        name: "",
        description: "",
        category: "Burgers",
        price: "",
        image_url: "",
      });
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function orderMenuItem(item) {
    if (!session || session.role !== "customer") {
      window.location.hash = "login";
      return;
    }
    if (!navigator.geolocation) {
      setError(
        "Enable device location before ordering for delivery assignment.",
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch(`${API_BASE}/orders/from-menu`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
              menu_item_id: item.id,
              quantity: 1,
              destination_lat: position.coords.latitude,
              destination_lng: position.coords.longitude,
            }),
          });
          if (!response.ok)
            throw new Error(
              (await response.json()).error || "Could not place order",
            );
          const created = await response.json();
          setOrder(created);
          setOrders((current) => [created, ...current]);
          window.location.hash = "orders";
        } catch (requestError) {
          setError(requestError.message);
        }
      },
      (positionError) =>
        setError(
          positionError.message || "Location permission is required to order",
        ),
    );
  }

  function addToCart(item) {
    setCart((current) => ({
      ...current,
      [item.id]: { ...item, quantity: (current[item.id]?.quantity || 0) + 1 },
    }));
  }

  function toggleFavorite(restaurant) {
    setFavoriteRestaurants((current) => {
      const next = current.some((item) => item.id === restaurant.id)
        ? current.filter((item) => item.id !== restaurant.id)
        : [...current, restaurant];
      localStorage.setItem("plate_favorites", JSON.stringify(next));
      return next;
    });
  }

  function askFoodAssistant(event) {
    event.preventDefault();
    const preference = assistantPreference.trim();
    if (!preference) return;
    const match = restaurants.find((restaurant) =>
      `${restaurant.name} ${restaurant.cuisine} ${restaurant.dish}`
        .toLowerCase()
        .includes(preference.toLowerCase()),
    );
    setAssistantReply(
      match
        ? `I found ${match.name} for you. ${match.dish} is a good match.`
        : `Try searching for ${preference} in Discover. I will filter nearby restaurants and menus for you.`,
    );
    if (match) setSearchTerm(preference);
  }

  function changeCartQuantity(itemID, change) {
    setCart((current) => {
      const nextQuantity = (current[itemID]?.quantity || 0) + change;
      if (nextQuantity <= 0) {
        const next = { ...current };
        delete next[itemID];
        return next;
      }
      return {
        ...current,
        [itemID]: { ...current[itemID], quantity: nextQuantity },
      };
    });
  }

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    };
  }

  function completePayment(event) {
    event.preventDefault();
    if (!deliveryLocation) {
      setError("Choose your precise delivery point on the map.");
      return;
    }
    setPaymentComplete(true);
    setCart({});
  }

  async function saveProfile(event) {
    event.preventDefault();
    setProfileSaved(false);
    try {
      const response = await fetch(`${API_BASE}/auth/profile`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(profileForm),
      });
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Could not save profile.",
        );
      const updated = await response.json();
      const nextSession = { ...session, ...updated };
      localStorage.setItem("plate_session", JSON.stringify(nextSession));
      setSession(nextSession);
      setProfileSaved(true);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function useDeviceDeliveryLocation() {
    if (!navigator.geolocation) {
      setError("Device location is unavailable in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeliveryLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (positionError) =>
        setError(positionError.message || "Location permission is required."),
    );
  }

  async function createOrder(event) {
    event?.preventDefault();
    setIsSending(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          Object.fromEntries(
            Object.entries(form).map(([key, value]) => [key, Number(value)]),
          ),
        ),
      });
      if (!response.ok) throw new Error(await response.text());
      const created = await response.json();
      setOrder(created);
      setOrders((current) => [created, ...current]);
      setShowOrderForm(false);
      setForm(emptyForm);
      setLastUpdate(new Date());
    } catch (requestError) {
      setError(requestError.message || "Could not create the order.");
    } finally {
      setIsSending(false);
    }
  }

  async function advanceStatus() {
    if (!nextStatus || !order?.id) return;
    setIsSending(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error(await response.text());
      const updated = await response.json();
      setOrder(updated);
      setOrders((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setLastUpdate(new Date());
    } catch (requestError) {
      setError(requestError.message || "Could not update the order.");
    } finally {
      setIsSending(false);
    }
  }

  async function sendLocation() {
    if (!order?.id || !location) return;
    setIsSending(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/driver/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: order.agent_id,
          order_id: order.id,
          latitude: location.lat,
          longitude: location.lng,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      setLastUpdate(new Date());
    } catch (requestError) {
      setError(requestError.message || "Could not send driver location.");
    } finally {
      setIsSending(false);
    }
  }

  function toggleDeviceGPS() {
    if (!order?.agent_id) {
      setError("The active order has no assigned driver.");
      return;
    }
    setGpsEnabled((current) => !current);
    setGpsStatus(gpsEnabled ? "Device GPS off" : "Starting device GPS...");
  }

  return (
    <main
      className={`app-shell ${page === "orders" ? "customer-orders-view" : ""} ${page === "profile" && !session ? "profile-logged-out" : ""}`}
    >
      <header className="topbar home-topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Radio size={18} />
          </div>
          <div>
            <strong>plate</strong>
            <span>food, at your door</span>
          </div>
        </div>
        <nav className="home-nav">
          <a href="#discover">Discover</a>
          <a href="#orders">Your orders</a>
          <a href="#restaurant">Restaurant</a>
          <a href="#agent">Agent</a>
          {session ? (
            <>
              <a href="#profile">Profile</a>
              <button
                className="location-button"
                onClick={() => {
                  localStorage.removeItem("plate_session");
                  setSession(null);
                  window.location.hash = "home";
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <a href="#login">Sign in</a>
          )}
          <button className="location-button">
            <MapPin size={14} /> Set location
          </button>
        </nav>
      </header>

      {page === "profile" && (
        <section className="profile-page">
          <div className="profile-heading">
            <div>
              <span className="label">CUSTOMER ACCOUNT</span>
              <h1>Your profile</h1>
              <p>
                Keep your contact and delivery details ready for a faster
                checkout.
              </p>
            </div>
            <div className="profile-avatar">
              {(session?.name || "C").slice(0, 1).toUpperCase()}
            </div>
          </div>
          <form className="profile-layout" onSubmit={saveProfile}>
            <div className="profile-form-card">
              <div className="profile-section-title">
                <UserRound size={18} />
                <div>
                  <h2>Personal details</h2>
                  <p>How restaurants and delivery partners can reach you.</p>
                </div>
              </div>
              <div className="profile-fields">
                <label>
                  FULL NAME
                  <input
                    required
                    value={profileForm.name}
                    onChange={(event) =>
                      setProfileForm({
                        ...profileForm,
                        name: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  EMAIL ADDRESS
                  <input
                    required
                    type="email"
                    value={profileForm.email}
                    onChange={(event) =>
                      setProfileForm({
                        ...profileForm,
                        email: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  PHONE NUMBER
                  <input
                    value={profileForm.phone}
                    onChange={(event) =>
                      setProfileForm({
                        ...profileForm,
                        phone: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
            </div>
            <div className="profile-form-card">
              <div className="profile-section-title">
                <MapPin size={18} />
                <div>
                  <h2>Default delivery address</h2>
                  <p>This address will be ready when you check out.</p>
                </div>
              </div>
              <div className="profile-fields">
                <label>
                  ADDRESS
                  <input
                    value={profileForm.address}
                    onChange={(event) =>
                      setProfileForm({
                        ...profileForm,
                        address: event.target.value,
                      })
                    }
                  />
                </label>
                <div className="profile-field-row">
                  <label>
                    CITY
                    <input
                      value={profileForm.city}
                      onChange={(event) =>
                        setProfileForm({
                          ...profileForm,
                          city: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    STATE
                    <input
                      value={profileForm.state}
                      onChange={(event) =>
                        setProfileForm({
                          ...profileForm,
                          state: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    POSTAL CODE
                    <input
                      value={profileForm.postal_code}
                      onChange={(event) =>
                        setProfileForm({
                          ...profileForm,
                          postal_code: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            </div>
            <div className="profile-actions">
              <button className="button button-primary" type="submit">
                Save profile
              </button>
              {profileSaved && (
                <span>
                  <CircleCheck size={15} /> Profile saved
                </span>
              )}
            </div>
          </form>
        </section>
      )}
      {page === "profile" && !session && (
        <section className="profile-login-guard">
          <LockKeyhole size={28} />
          <h2>Sign in to open your customer profile</h2>
          <p>
            Save your name, delivery addresses, favourites, and order history in
            one place.
          </p>
          <a className="button button-primary" href="#login">
            Customer sign in
          </a>
        </section>
      )}
      {page === "profile" && session && (
        <section className="customer-tools">
          <div className="customer-tool-card assistant-card">
            <div className="tool-icon">
              <MessageCircle size={18} />
            </div>
            <div>
              <span className="label">PLATE ASSIST</span>
              <h2>What are you in the mood for?</h2>
              <p>Tell me a preference and I will guide you to a dish.</p>
              <form onSubmit={askFoodAssistant}>
                <input
                  value={assistantPreference}
                  onChange={(event) =>
                    setAssistantPreference(event.target.value)
                  }
                  placeholder="Spicy, vegetarian, quick dinner..."
                />
                <button className="button button-primary" type="submit">
                  Ask Plate
                </button>
              </form>
              {assistantReply && (
                <span className="assistant-reply">
                  {assistantReply} <a href="#discover">Open Discover</a>
                </span>
              )}
            </div>
          </div>
          <div className="customer-tool-grid">
            <a className="customer-tool-card" href="#orders">
              <Clock3 size={18} />
              <div>
                <h3>Past orders & live tracking</h3>
                <p>{orders.length} order records available</p>
              </div>
              <ArrowUpRight size={16} />
            </a>
            <div className="customer-tool-card">
              <Heart size={18} />
              <div>
                <h3>Favourites</h3>
                <p>{favoriteRestaurants.length} saved restaurants</p>
              </div>
            </div>
            <a className="customer-tool-card" href="mailto:support@plate.local">
              <MessageCircle size={18} />
              <div>
                <h3>Contact restaurant</h3>
                <p>Send a message about an order</p>
              </div>
              <ArrowUpRight size={16} />
            </a>
            <a className="customer-tool-card" href="#help">
              <HelpCircle size={18} />
              <div>
                <h3>Help & support</h3>
                <p>Get help with payments or delivery</p>
              </div>
              <ArrowUpRight size={16} />
            </a>
          </div>
        </section>
      )}

      {page === "payment" && (
        <section className="payment-page">
          {!session ? (
            <div className="payment-guard">
              <LockKeyhole size={28} />
              <h1>Sign in to checkout</h1>
              <p>Your cart is waiting. Sign in to continue securely.</p>
              <a className="button button-primary" href="#login">
                Go to customer sign in
              </a>
            </div>
          ) : paymentComplete ? (
            <div className="payment-success">
              <div className="success-icon">
                <CircleCheck size={32} />
              </div>
              <span className="label">PAYMENT CONFIRMED</span>
              <h1>Your order is on its way.</h1>
              <p>
                We have sent the order to the restaurant. You can follow its
                live journey from your orders page.
              </p>
              <a className="button button-primary" href="#orders">
                Track my order
              </a>
            </div>
          ) : (
            <>
              <div className="payment-heading">
                <a className="back-link" href="#discover">
                  ← Back to menu
                </a>
                <span className="secure-badge">
                  <LockKeyhole size={13} /> SECURE CHECKOUT
                </span>
                <h1>Finish your order.</h1>
                <p>
                  Almost there, {session.name}. Your meal is ready to leave the
                  kitchen.
                </p>
              </div>
              <div className="payment-layout">
                <form className="payment-form" onSubmit={completePayment}>
                  <div className="payment-section">
                    <div className="payment-section-title">
                      <span>01</span>
                      <div>
                        <h2>Delivery details</h2>
                        <p>Where should we bring your order?</p>
                      </div>
                    </div>
                    <div className="address-fields">
                      <input
                        required
                        placeholder="House / flat / building"
                        value={addressFields.house}
                        onChange={(event) =>
                          setAddressFields({
                            ...addressFields,
                            house: event.target.value,
                          })
                        }
                      />
                      <input
                        required
                        placeholder="Street / area"
                        value={addressFields.street}
                        onChange={(event) =>
                          setAddressFields({
                            ...addressFields,
                            street: event.target.value,
                          })
                        }
                      />
                      <div className="address-field-row">
                        <input
                          required
                          placeholder="City"
                          value={addressFields.city}
                          onChange={(event) =>
                            setAddressFields({
                              ...addressFields,
                              city: event.target.value,
                            })
                          }
                        />
                        <input
                          required
                          placeholder="State"
                          value={addressFields.state}
                          onChange={(event) =>
                            setAddressFields({
                              ...addressFields,
                              state: event.target.value,
                            })
                          }
                        />
                        <input
                          required
                          placeholder="Postal code"
                          value={addressFields.postalCode}
                          onChange={(event) =>
                            setAddressFields({
                              ...addressFields,
                              postalCode: event.target.value,
                            })
                          }
                        />
                      </div>
                      <input
                        placeholder="Landmark (optional)"
                        value={addressFields.landmark}
                        onChange={(event) =>
                          setAddressFields({
                            ...addressFields,
                            landmark: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="location-picker-heading">
                      <span>Pin your exact delivery point</span>
                      <button type="button" onClick={useDeviceDeliveryLocation}>
                        <LocateFixed size={14} /> Use device location
                      </button>
                    </div>
                    <div className="payment-map">
                      <PaymentLocationPicker
                        location={deliveryLocation}
                        onLocationChange={setDeliveryLocation}
                      />
                    </div>
                    <div className="selected-coordinates">
                      {deliveryLocation ? (
                        <>
                          <MapPin size={14} /> {deliveryLocation.lat.toFixed(6)}
                          , {deliveryLocation.lng.toFixed(6)}
                        </>
                      ) : (
                        <>
                          <MapPin size={14} /> Click on the map to choose a
                          precise point
                        </>
                      )}
                    </div>
                    <textarea
                      placeholder="Delivery instructions (optional)"
                      value={paymentForm.address}
                      onChange={(event) =>
                        setPaymentForm({
                          ...paymentForm,
                          address: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="payment-section">
                    <div className="payment-section-title">
                      <span>02</span>
                      <div>
                        <h2>Payment method</h2>
                        <p>Choose how you would like to pay.</p>
                      </div>
                    </div>
                    <div className="payment-methods">
                      <button
                        type="button"
                        className={
                          paymentMethod === "card"
                            ? "payment-method active"
                            : "payment-method"
                        }
                        onClick={() => setPaymentMethod("card")}
                      >
                        <CreditCard size={18} />
                        <span>Card</span>
                      </button>
                      <button
                        type="button"
                        className={
                          paymentMethod === "wallet"
                            ? "payment-method active"
                            : "payment-method"
                        }
                        onClick={() => setPaymentMethod("wallet")}
                      >
                        <WalletCards size={18} />
                        <span>UPI / Wallet</span>
                      </button>
                    </div>
                    {paymentMethod === "card" ? (
                      <div className="card-fields">
                        <input
                          required
                          placeholder="Name on card"
                          value={paymentForm.cardName}
                          onChange={(event) =>
                            setPaymentForm({
                              ...paymentForm,
                              cardName: event.target.value,
                            })
                          }
                        />
                        <input
                          required
                          inputMode="numeric"
                          placeholder="Card number"
                          maxLength="19"
                          value={paymentForm.cardNumber}
                          onChange={(event) =>
                            setPaymentForm({
                              ...paymentForm,
                              cardNumber: event.target.value,
                            })
                          }
                        />
                        <div>
                          <input
                            required
                            placeholder="MM / YY"
                            maxLength="5"
                            value={paymentForm.expiry}
                            onChange={(event) =>
                              setPaymentForm({
                                ...paymentForm,
                                expiry: event.target.value,
                              })
                            }
                          />
                          <input
                            required
                            inputMode="numeric"
                            placeholder="CVV"
                            maxLength="4"
                            value={paymentForm.cvv}
                            onChange={(event) =>
                              setPaymentForm({
                                ...paymentForm,
                                cvv: event.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="wallet-note">
                        <WalletCards size={20} />
                        <span>
                          Choose your preferred UPI or wallet after continuing.
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    className="button button-primary pay-button"
                    type="submit"
                  >
                    <LockKeyhole size={16} /> Pay ₹{(cartTotal + 35).toFixed(2)}
                  </button>
                </form>
                <aside className="payment-summary">
                  <span className="label">ORDER SUMMARY</span>
                  <h2>{cartCount} items from your basket</h2>
                  <div className="summary-items">
                    {cartItems.length === 0 ? (
                      <p>
                        Your cart is empty. Return to Discover to add items.
                      </p>
                    ) : (
                      cartItems.map((item) => (
                        <div key={item.id}>
                          <span>
                            {item.name} × {item.quantity}
                          </span>
                          <strong>
                            ₹{(item.price * item.quantity).toFixed(2)}
                          </strong>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="summary-line">
                    <span>Item subtotal</span>
                    <strong>₹{cartTotal.toFixed(2)}</strong>
                  </div>
                  <div className="summary-line">
                    <span>Delivery fee</span>
                    <strong>₹35.00</strong>
                  </div>
                  <div className="summary-total">
                    <span>Total payable</span>
                    <strong>₹{(cartTotal + 35).toFixed(2)}</strong>
                  </div>
                  <div className="payment-trust">
                    <LockKeyhole size={14} /> Payments are encrypted and secure
                  </div>
                </aside>
              </div>
            </>
          )}
        </section>
      )}

      {page === "login" && (
        <section className="role-page">
          <div className="role-heading">
            <span className="label">WELCOME BACK</span>
            <h1>Sign in to Plate</h1>
            <p>
              Log in to order food, view your orders, and follow every delivery.
            </p>
          </div>
          <form className="role-card login-card" onSubmit={login}>
            <h2>Customer login</h2>
            <p>Demo: alice@example.com / customer123</p>
            <input
              required
              type="email"
              placeholder="Email address"
              value={loginForm.email}
              onChange={(event) =>
                setLoginForm({ ...loginForm, email: event.target.value })
              }
            />
            <input
              required
              type="password"
              placeholder="Password"
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm({ ...loginForm, password: event.target.value })
              }
            />
            <button className="button button-primary" type="submit">
              Sign in and start ordering
            </button>
          </form>
        </section>
      )}

      {page === "restaurant" && (
        <section className="role-page">
          <div className="role-heading">
            <span className="label">PARTNER PORTAL</span>
            <h1>Restaurant menu studio</h1>
            <p>Publish a dish once and it appears in Discover for customers.</p>
          </div>
          {!session ? (
            <form className="role-card login-card" onSubmit={login}>
              <h2>Restaurant login</h2>
              <p>Demo: bob-rest@example.com / restaurant123</p>
              <input
                required
                type="email"
                placeholder="Restaurant email"
                value={loginForm.email}
                onChange={(event) =>
                  setLoginForm({ ...loginForm, email: event.target.value })
                }
              />
              <input
                required
                type="password"
                placeholder="Password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm({ ...loginForm, password: event.target.value })
                }
              />
              <button className="button button-primary" type="submit">
                Login to restaurant
              </button>
            </form>
          ) : (
            <div className="role-columns">
              <form className="role-card" onSubmit={publishMenuItem}>
                <h2>Post a food item</h2>
                <input
                  required
                  placeholder="Item name"
                  value={menuForm.name}
                  onChange={(event) =>
                    setMenuForm({ ...menuForm, name: event.target.value })
                  }
                />
                <input
                  placeholder="Description"
                  value={menuForm.description}
                  onChange={(event) =>
                    setMenuForm({
                      ...menuForm,
                      description: event.target.value,
                    })
                  }
                />
                <input
                  required
                  placeholder="Category"
                  value={menuForm.category}
                  onChange={(event) =>
                    setMenuForm({ ...menuForm, category: event.target.value })
                  }
                />
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price"
                  value={menuForm.price}
                  onChange={(event) =>
                    setMenuForm({ ...menuForm, price: event.target.value })
                  }
                />
                <input
                  required
                  type="url"
                  placeholder="Food image URL"
                  value={menuForm.image_url}
                  onChange={(event) =>
                    setMenuForm({ ...menuForm, image_url: event.target.value })
                  }
                />
                <button className="button button-primary" type="submit">
                  Publish to Discover
                </button>
              </form>
              <div className="role-card menu-preview">
                <h2>Published menu</h2>
                {menuItems
                  .filter(
                    (item) => item.restaurant_id === session.restaurant_id,
                  )
                  .map((item) => (
                    <div className="menu-row" key={item.id}>
                      <img src={item.image_url} alt="" />
                      <div>
                        <strong>{item.name}</strong>
                        <span>
                          {item.category} · ₹{item.price}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>
      )}

      {page === "agent" && (
        <section className="role-page">
          <div className="role-heading">
            <span className="label">DELIVERY NETWORK</span>
            <h1>Agent dashboard</h1>
            <p>
              Nearby orders are assigned automatically when a customer places an
              order.
            </p>
          </div>
          {!session ? (
            <form className="role-card login-card" onSubmit={login}>
              <h2>Agent login</h2>
              <p>Use your delivery-agent account to see assigned trips.</p>
              <input
                required
                type="email"
                placeholder="Agent email"
                value={loginForm.email}
                onChange={(event) =>
                  setLoginForm({ ...loginForm, email: event.target.value })
                }
              />
              <input
                required
                type="password"
                placeholder="Password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm({ ...loginForm, password: event.target.value })
                }
              />
              <button className="button button-primary" type="submit">
                Open agent dashboard
              </button>
            </form>
          ) : (
            <div className="role-card">
              <h2>Assigned deliveries</h2>
              {agentOrders.length === 0 ? (
                <p className="empty-orders">No active nearby assignments.</p>
              ) : (
                agentOrders.map((item) => (
                  <div className="agent-order-row" key={item.id}>
                    <div>
                      <strong>#{item.id.slice(0, 8).toUpperCase()}</strong>
                      <span>{statusLabels[item.status]}</span>
                    </div>
                    <a href="#orders">
                      Open live route <ArrowUpRight size={14} />
                    </a>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      )}

      {page === "home" && (
        <>
          <section className="food-hero" id="discover">
            <div className="food-hero-copy">
              <p className="eyebrow">DELIVERY THAT FITS YOUR MOOD</p>
              <h1>
                Good food.
                <br />
                <em>Great mood.</em>
              </h1>
              <p className="lede">
                Discover the best meals around you, delivered while they are
                still worth talking about.
              </p>
              <div className="food-search">
                <MapPin size={18} />
                <input
                  aria-label="Search restaurants or dishes"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search restaurants, dishes or cuisines"
                />
                <button aria-label="Search">
                  <ArrowUpRight size={18} />
                </button>
              </div>
              <div className="hero-note">
                <span className="status-dot" /> Live delivery tracking is built
                in
              </div>
            </div>
            <div className="food-hero-art">
              <span className="hero-stamp">
                FRESH
                <br />
                FAVES
              </span>
              <div className="hero-art-caption">
                <strong>Made for tonight</strong>
                <span>Fast, warm, and on its way</span>
              </div>
            </div>
          </section>

          <section className="spandana-home-card">
            <div className="spandana-mark">S</div>
            <div className="spandana-copy">
              <span className="label">SPANDANA AI · YOUR FOOD CONCIERGE</span>
              <h2>Tell Spandana what you feel like eating.</h2>
              <p>
                Get a quick recommendation based on your mood, diet, time, or
                craving.
              </p>
              <form onSubmit={askFoodAssistant} className="spandana-form">
                <input
                  value={assistantPreference}
                  onChange={(event) =>
                    setAssistantPreference(event.target.value)
                  }
                  placeholder="Try “spicy biryani”, “healthy lunch”, or “quick pizza”"
                  aria-label="Ask Spandana AI for a food recommendation"
                />
                <button className="button button-primary" type="submit">
                  Ask Spandana
                </button>
              </form>
              {assistantReply && (
                <div className="spandana-reply">
                  <span className="status-dot" /> {assistantReply}{" "}
                  <a href="#discover">See recommendations</a>
                </div>
              )}
            </div>
            <div className="spandana-sparkle">✦</div>
          </section>

          <section className="cuisine-strip">
            <span className="label">BROWSE BY CRAVING</span>
            <div className="cuisine-list">
              {categories.slice(1).map((category) => (
                <button
                  className={selectedCategory === category ? "active" : ""}
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </section>
          <section className="published-menu-section">
            <div className="discover-heading">
              <div>
                <span className="label">LIVE RESTAURANT MENUS</span>
                <h2>Fresh from partner kitchens</h2>
              </div>
              <span className="result-count">{menuItems.length} items</span>
            </div>
            <div className="menu-card-grid">
              {menuItems.map((item) => (
                <article className="menu-card" key={item.id}>
                  <img src={item.image_url} alt={item.name} />
                  <div>
                    <span className="menu-category">{item.category}</span>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <strong>₹{item.price}</strong>
                    <button
                      className="button button-primary"
                      onClick={() => orderMenuItem(item)}
                    >
                      Order item
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {page === "home" && (
        <section className="discover-section">
          <div className="discover-heading">
            <div>
              <span className="label">NEARBY ON PLATE</span>
              <h2>Restaurants for every craving</h2>
            </div>
            <span className="result-count">
              {visibleRestaurants.length} places found
            </span>
          </div>
          <div className="category-tabs">
            {categories.map((category) => (
              <button
                className={selectedCategory === category ? "active" : ""}
                key={category}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="restaurant-grid">
            {visibleRestaurants.map((restaurant) => (
              <button
                className="restaurant-card"
                key={restaurant.id}
                onClick={() => setSelectedRestaurant(restaurant)}
              >
                <div className="restaurant-image">
                  <img
                    src={restaurant.image}
                    alt={restaurant.dish}
                    loading="lazy"
                  />
                  <span className="delivery-badge">FREE DELIVERY</span>
                  <span
                    className={`save-button ${favoriteRestaurants.some((item) => item.id === restaurant.id) ? "saved" : ""}`}
                    role="button"
                    aria-label={`Favorite ${restaurant.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleFavorite(restaurant);
                    }}
                  >
                    ♡
                  </span>
                </div>
                <div className="restaurant-card-body">
                  <div className="restaurant-title">
                    <h3>{restaurant.name}</h3>
                    <span className="rating">
                      <Star size={12} fill="currentColor" /> {restaurant.rating}
                    </span>
                  </div>
                  <p className="restaurant-cuisine">
                    {restaurant.cuisine} <span>·</span> {restaurant.price}
                  </p>
                  <p className="restaurant-dish">{restaurant.dish}</p>
                  <div className="restaurant-meta">
                    <span>{restaurant.time}</span>
                    <span>{restaurant.address}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {visibleRestaurants.length === 0 && (
            <div className="empty-discover">
              No restaurants match “{searchTerm}”. Try another dish or category.
            </div>
          )}
        </section>
      )}

      {page === "home" && selectedRestaurant && (
        <section className="restaurant-menu-view">
          <div className="menu-view-heading">
            <div>
              <span className="label">RESTAURANT MENU</span>
              <h2>{selectedRestaurant.name}</h2>
              <p>
                {selectedRestaurant.address} · {selectedRestaurant.cuisine}
              </p>
            </div>
            <button
              className="back-link-button"
              onClick={() => setSelectedRestaurant(null)}
            >
              Close menu
            </button>
          </div>
          <div className="restaurant-menu-layout">
            <div className="restaurant-item-list">
              {selectedMenuItems.length === 0 ? (
                <div className="empty-discover">
                  This restaurant has no published items yet.
                </div>
              ) : (
                selectedMenuItems.map((item) => (
                  <article className="food-item-row" key={item.id}>
                    <img src={item.image_url} alt={item.name} />
                    <div className="food-item-copy">
                      <span className="menu-category">{item.category}</span>
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                      <strong>₹{Number(item.price).toFixed(2)}</strong>
                    </div>
                    <button
                      className="add-item-button"
                      onClick={() => addToCart(item)}
                    >
                      Add
                    </button>
                  </article>
                ))
              )}
            </div>
            <aside className="cart-panel">
              <div className="cart-panel-heading">
                <div>
                  <span className="label">YOUR CART</span>
                  <h3>{cartCount} items</h3>
                </div>
                <ShoppingBag size={20} />
              </div>
              {cartItems.length === 0 ? (
                <p className="empty-cart">
                  Add something delicious to get started.
                </p>
              ) : (
                <>
                  {cartItems.map((item) => (
                    <div className="cart-item" key={item.id}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                      <div className="quantity-control">
                        <button
                          onClick={() => changeCartQuantity(item.id, -1)}
                          aria-label={`Decrease ${item.name}`}
                        >
                          −
                        </button>
                        <strong>{item.quantity}</strong>
                        <button
                          onClick={() => changeCartQuantity(item.id, 1)}
                          aria-label={`Increase ${item.name}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="cart-total">
                    <span>Subtotal</span>
                    <strong>₹{cartTotal.toFixed(2)}</strong>
                  </div>
                  <button
                    className="button button-primary cart-checkout"
                    onClick={() =>
                      setError(
                        session
                          ? "Checkout is ready for the authenticated customer flow."
                          : "Sign in before checkout.",
                      )
                    }
                  >
                    {session ? "Proceed to checkout" : "Sign in to checkout"}
                  </button>
                </>
              )}
            </aside>
          </div>
        </section>
      )}

      {page === "orders" && (
        <>
          <section className="customer-orders-page">
            <div className="customer-page-heading">
              <div>
                <span className="label">CUSTOMER ACCOUNT</span>
                <h1>Your orders</h1>
                <p>
                  See what is arriving, revisit past meals, and follow your
                  active delivery.
                </p>
              </div>
              <a className="back-link" href="#discover">
                ← Browse restaurants
              </a>
            </div>
            <div className="customer-order-list">
              {orders.map((item) => (
                <button
                  className={`customer-order-card ${item.id === order?.id ? "selected" : ""}`}
                  key={item.id}
                  onClick={() => setOrder(item)}
                >
                  <div className="customer-order-icon">
                    <PackageCheck size={19} />
                  </div>
                  <div className="customer-order-copy">
                    <strong>Order #{item.id.slice(0, 8).toUpperCase()}</strong>
                    <span>
                      Restaurant #{item.restaurant_id} · ₹
                      {Number(item.total_amount).toFixed(2)}
                    </span>
                    <small>{new Date(item.created_at).toLocaleString()}</small>
                  </div>
                  <div className="customer-order-status">
                    <span
                      className={
                        item.status === "ORDER_DELIVERED" ? "delivered" : ""
                      }
                    >
                      {statusLabels[item.status]}
                    </span>
                    <ArrowUpRight size={16} />
                  </div>
                </button>
              ))}
              {orders.length === 0 && (
                <div className="empty-orders">
                  You have no orders yet. Browse restaurants to start your first
                  order.
                </div>
              )}
            </div>
          </section>

          {showOrderForm && (
            <form className="panel order-form" onSubmit={createOrder}>
              <div className="panel-header">
                <div>
                  <span className="label">NEW ORDER</span>
                  <h2>Supply order coordinates</h2>
                </div>
                <span className="event-count">POST /orders</span>
              </div>
              <div className="form-grid">
                {Object.entries(form).map(([field, value]) => (
                  <label key={field}>
                    {field.replaceAll("_", " ").toUpperCase()}
                    <input
                      required
                      type={
                        field.includes("id") ||
                        field.includes("lat") ||
                        field.includes("lng") ||
                        field === "total_amount"
                          ? "number"
                          : "text"
                      }
                      step={
                        field.includes("lat") || field.includes("lng")
                          ? "0.000001"
                          : undefined
                      }
                      value={value}
                      onChange={(event) =>
                        setForm({ ...form, [field]: event.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
              <button
                className="button button-primary"
                type="submit"
                disabled={isSending}
              >
                <Send size={16} />{" "}
                {isSending ? "Creating..." : "Create from entered data"}
              </button>
            </form>
          )}

          <section className="command-strip">
            <div className="order-identity">
              <span className="label">ACTIVE ORDER</span>
              <strong>#{orderShortID}</strong>
              <span className="pill pill-amber">
                {order ? statusLabels[order.status] : "No order selected"}
              </span>
            </div>
            <div className="connection">
              <span className={`connection-icon ${socketState}`}>
                <Wifi size={15} />
              </span>
              <span>
                {socketState === "live"
                  ? "WebSocket streaming"
                  : "Waiting for tracking"}
              </span>
              <small>
                {lastUpdate
                  ? `updated ${lastUpdate.toLocaleTimeString()}`
                  : "no events yet"}
              </small>
            </div>
          </section>

          <section className="home-overview" id="orders">
            <div className="metric-card metric-highlight">
              <span className="label">ORDERS TODAY</span>
              <strong>{orders.length}</strong>
              <span>
                <Activity size={13} /> Live database count
              </span>
            </div>
            <div className="metric-card">
              <span className="label">IN PROGRESS</span>
              <strong>
                {
                  orders.filter((item) => item.status !== "ORDER_DELIVERED")
                    .length
                }
              </strong>
              <span>
                <Clock3 size={13} /> Active journeys
              </span>
            </div>
            <div className="metric-card">
              <span className="label">DELIVERED</span>
              <strong>
                {
                  orders.filter((item) => item.status === "ORDER_DELIVERED")
                    .length
                }
              </strong>
              <span>
                <CircleCheck size={13} /> Completed handoffs
              </span>
            </div>
            <div className="metric-card">
              <span className="label">DRIVER SIGNAL</span>
              <strong className="signal-value">
                <span className="status-dot" />{" "}
                {socketState === "live" ? "LIVE" : "IDLE"}
              </strong>
              <span>
                <Truck size={13} /> Tracking channel
              </span>
            </div>
          </section>

          <section className="recent-orders panel">
            <div className="panel-header">
              <div>
                <span className="label">RECENT ORDERS</span>
                <h2>Dispatch queue</h2>
              </div>
              <span className="event-count">{orders.length} LOADED</span>
            </div>
            <div className="order-list">
              {orders.slice(0, 5).map((item) => (
                <button
                  className={`order-row ${item.id === order?.id ? "selected" : ""}`}
                  key={item.id}
                  onClick={() => setOrder(item)}
                >
                  <span className="order-row-id">
                    #{item.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span className="order-row-route">
                    Restaurant {item.restaurant_id} <span>→</span> Customer{" "}
                    {item.customer_id}
                  </span>
                  <span
                    className={`order-row-status ${item.status === "ORDER_DELIVERED" ? "delivered" : ""}`}
                  >
                    {statusLabels[item.status]}
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
              {orders.length === 0 && (
                <div className="empty-orders">
                  No orders returned from the API. Create one to begin tracking.
                </div>
              )}
            </div>
          </section>

          <section className="workspace-grid">
            <div className="primary-column">
              <article className="panel route-panel">
                <div className="panel-header">
                  <div>
                    <span className="label">LIVE ROUTE</span>
                    <h2>Driver position</h2>
                  </div>
                  <button className="icon-button" title="Center route">
                    <Crosshair size={18} />
                  </button>
                </div>
                <div className="route-map">
                  <TrackingMap order={order} driverPosition={driverPosition} />
                </div>
                <div className="route-footer">
                  <div>
                    <span className="label">EST. ARRIVAL</span>
                    <strong>
                      {order?.status === "ORDER_DELIVERED"
                        ? "Delivered"
                        : order
                          ? "Live estimate pending"
                          : "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="label">DRIVER ID</span>
                    <strong>{order?.agent_id || "Not assigned"}</strong>
                  </div>
                  <div>
                    <span className="label">DESTINATION</span>
                    <strong>
                      {order
                        ? `${order.destination_lat.toFixed(4)}, ${order.destination_lng.toFixed(4)}`
                        : "—"}
                    </strong>
                  </div>
                </div>
              </article>

              <article className="panel timeline-panel">
                <div className="panel-header">
                  <div>
                    <span className="label">LIFECYCLE</span>
                    <h2>Order timeline</h2>
                  </div>
                  <span className="event-count">
                    {currentIndex + 1} / {statusOrder.length} EVENTS
                  </span>
                </div>
                <div className="timeline">
                  {statusOrder.map((status, index) => {
                    const complete = index < currentIndex;
                    const active = index === currentIndex;
                    return (
                      <div
                        className={`timeline-item ${complete ? "complete" : ""} ${active ? "active" : ""}`}
                        key={status}
                      >
                        <div className="timeline-node">
                          {complete ? (
                            <CircleCheck size={14} />
                          ) : active ? (
                            <Activity size={14} />
                          ) : (
                            <span>{String(index + 1).padStart(2, "0")}</span>
                          )}
                        </div>
                        <div className="timeline-copy">
                          <strong>{statusLabels[status]}</strong>
                          <span>
                            {active
                              ? "Current operation"
                              : complete
                                ? "Completed"
                                : "Queued"}
                          </span>
                        </div>
                        {active && (
                          <span className="live-badge">
                            <span className="status-dot" /> LIVE
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </article>
            </div>

            <aside className="side-column">
              <article className="panel next-panel">
                <div className="panel-header">
                  <div>
                    <span className="label">OPERATOR ACTION</span>
                    <h2>Move the order</h2>
                  </div>
                  <ArrowUpRight size={18} />
                </div>
                <p>
                  Advance the state machine one valid transition at a time.
                  Invalid jumps are rejected by the API.
                </p>
                <button
                  className="button button-dark"
                  onClick={advanceStatus}
                  disabled={!nextStatus || !order?.id || isSending}
                >
                  {nextStatus ? (
                    <>
                      <PackageCheck size={16} /> Set {statusLabels[nextStatus]}
                    </>
                  ) : (
                    <>
                      <CircleCheck size={16} /> Delivery complete
                    </>
                  )}
                </button>
              </article>

              <article className="panel location-panel">
                <div className="panel-header">
                  <div>
                    <span className="label">DRIVER INPUT</span>
                    <h2>GPS ping</h2>
                  </div>
                  <Smartphone size={18} />
                </div>
                <div className="gps-status">
                  <span
                    className={`status-dot ${gpsEnabled ? "gps-active" : ""}`}
                  />{" "}
                  {gpsStatus}
                </div>
                <button
                  className={`button ${gpsEnabled ? "button-gps-active" : "button-outline"}`}
                  onClick={toggleDeviceGPS}
                  disabled={!order?.agent_id}
                >
                  {gpsEnabled ? (
                    <>
                      <LocateFixed size={16} /> Stop device GPS
                    </>
                  ) : (
                    <>
                      <LocateFixed size={16} /> Use device GPS
                    </>
                  )}
                </button>
                <div className="input-grid">
                  <label>
                    LATITUDE
                    <input
                      required
                      type="number"
                      step="0.000001"
                      value={location?.lat || ""}
                      onChange={(event) =>
                        setLocation({
                          ...(location || {}),
                          lat: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    LONGITUDE
                    <input
                      required
                      type="number"
                      step="0.000001"
                      value={location?.lng || ""}
                      onChange={(event) =>
                        setLocation({
                          ...(location || {}),
                          lng: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <button
                  className="button button-outline"
                  onClick={sendLocation}
                  disabled={
                    !order?.id || !order?.agent_id || !location || isSending
                  }
                >
                  <Navigation size={16} /> Broadcast manual GPS update
                </button>
              </article>

              <article className="panel parties-panel">
                <div className="panel-header">
                  <div>
                    <span className="label">ORDER PARTICIPANTS</span>
                    <h2>Three perspectives</h2>
                  </div>
                  <ShieldCheck size={18} />
                </div>
                <div className="party-row">
                  <span className="party-icon customer">
                    <UserRound size={16} />
                  </span>
                  <div>
                    <strong>Customer #{order?.customer_id || "—"}</strong>
                    <span>Watching order progress</span>
                  </div>
                  <span className="party-state">ONLINE</span>
                </div>
                <div className="party-row">
                  <span className="party-icon restaurant">
                    <ChefHat size={16} />
                  </span>
                  <div>
                    <strong>Restaurant #{order?.restaurant_id || "—"}</strong>
                    <span>Kitchen operational</span>
                  </div>
                  <span className="party-state">READY</span>
                </div>
                <div className="party-row">
                  <span className="party-icon driver">
                    <Truck size={16} />
                  </span>
                  <div>
                    <strong>Driver #{order?.agent_id || "—"}</strong>
                    <span>Location sharing active</span>
                  </div>
                  <span className="party-state">
                    {order?.agent_id ? "LIVE" : "UNASSIGNED"}
                  </span>
                </div>
              </article>
            </aside>
          </section>

          <footer className="footer">
            <span>
              <Clock3 size={14} /> Event stream retained in PostgreSQL
            </span>
            <span>
              <ExternalLink size={14} /> PostGIS spatial history enabled
            </span>
            <span>
              {socketState === "live" ? (
                <Wifi size={14} />
              ) : (
                <WifiOff size={14} />
              )}{" "}
              {socketState === "live"
                ? "Real-time connected"
                : "WebSocket disconnected"}
            </span>
          </footer>
        </>
      )}
      {error && (
        <div className="toast">
          <span>{error}</span>
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
    </main>
  );
}

export default App;
