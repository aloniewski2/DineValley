import React from "react";

function RestaurantList({ restaurants }) {
  return (
    <div>
      <h2>Restaurants</h2>
      <ul>
        {restaurants.map(rest => (
          <li key={rest.id}>
            <strong>{rest.name}</strong> — {rest.cuisine} — {rest.location} — {rest.priceRange} — {rest.rating} stars
            <ul>
              {rest.features.map(f => <li key={f}>{f}</li>)}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
export default RestaurantList;
