import React from 'react';
import { RestaurantCard } from "../../components/RestaurantCard";

export const AllRestaurantsSection = () => {
  return (
    <div className="box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)]">
      <div className="items-center box-border caret-transparent flex justify-between outline-[oklab(0.708_0_0_/_0.5)] mb-4">
        <h2 className="box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)]">
          All Restaurants
        </h2>
      </div>
      <div className="box-border caret-transparent gap-x-4 grid grid-cols-[repeat(1,minmax(0px,1fr))] outline-[oklab(0.708_0_0_/_0.5)] gap-y-4 md:grid-cols-[repeat(3,minmax(0px,1fr))]">
        <RestaurantCard
          imageUrl="https://c.animaapp.com/mfn8xsm35Iri3M/assets/1.jpg"
          name="Bella Vista Italian"
          rating="4.8"
          reviewCount="247"
          address="123 Main St, Bethlehem, PA 18018"
          cuisineTypes={["Italian", "Mediterranean"]}
          priceRange="$$$"
          favoriteIconUrl="https://c.animaapp.com/mfn8xsm35Iri3M/assets/icon-12.svg"
          favoriteIconClass="text-[oklch(0.446_0.03_256.802)]"
        />
        <RestaurantCard
          imageUrl="https://c.animaapp.com/mfn8xsm35Iri3M/assets/3.jpg"
          name="Sakura Sushi House"
          rating="4.6"
          reviewCount="189"
          address="456 Cedar Ave, Allentown, PA 18104"
          cuisineTypes={["Japanese", "Sushi"]}
          priceRange="$$"
          favoriteIconUrl="https://c.animaapp.com/mfn8xsm35Iri3M/assets/icon-15.svg"
          favoriteIconClass="text-[oklch(0.637_0.237_25.331)]"
        />
        <RestaurantCard
          imageUrl="https://c.animaapp.com/mfn8xsm35Iri3M/assets/4.jpg"
          name="Tony's Wood Fired Pizza"
          rating="4.4"
          reviewCount="312"
          address="789 Broad St, Easton, PA 18042"
          cuisineTypes={["Italian", "Pizza"]}
          priceRange="$$"
          favoriteIconUrl="https://c.animaapp.com/mfn8xsm35Iri3M/assets/icon-12.svg"
          favoriteIconClass="text-[oklch(0.446_0.03_256.802)]"
          showClosedBadge={true}
        />
        <RestaurantCard
          imageUrl="https://c.animaapp.com/mfn8xsm35Iri3M/assets/5.jpg"
          name="El Corazón Mexican Grill"
          rating="4.7"
          reviewCount="156"
          address="321 Hamilton St, Allentown, PA 18101"
          cuisineTypes={["Mexican", "Latin American"]}
          priceRange="$$"
          favoriteIconUrl="https://c.animaapp.com/mfn8xsm35Iri3M/assets/icon-15.svg"
          favoriteIconClass="text-[oklch(0.637_0.237_25.331)]"
        />
        <RestaurantCard
          imageUrl="https://c.animaapp.com/mfn8xsm35Iri3M/assets/2.jpg"
          name="The Copper Kettle"
          rating="4.5"
          reviewCount="203"
          address="654 Third St, Bethlehem, PA 18015"
          cuisineTypes={["American", "Contemporary"]}
          priceRange="$$$"
          favoriteIconUrl="https://c.animaapp.com/mfn8xsm35Iri3M/assets/icon-12.svg"
          favoriteIconClass="text-[oklch(0.446_0.03_256.802)]"
        />
        <RestaurantCard
          imageUrl="https://c.animaapp.com/mfn8xsm35Iri3M/assets/6.jpg"
          name="Burger & Brew Co."
          rating="4.3"
          reviewCount="134"
          address="987 Union Blvd, Allentown, PA 18103"
          cuisineTypes={["American", "Burgers"]}
          priceRange="$$"
          favoriteIconUrl="https://c.animaapp.com/mfn8xsm35Iri3M/assets/icon-12.svg"
          favoriteIconClass="text-[oklch(0.446_0.03_256.802)]"
        />
      </div>
    </div>
  );
};
