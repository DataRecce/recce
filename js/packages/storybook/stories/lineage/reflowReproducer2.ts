import type { LineageGraph, LineageGraphNode } from "@datarecce/ui/contexts";

const largeReproducerLineage = {
  base: {
    parent_map: {
      "model.jaffle_shop.stg_products": [
        "source.jaffle_shop.ecom.raw_products",
      ],
      "model.jaffle_shop.stg_customers": [
        "source.jaffle_shop.ecom.raw_customers",
      ],
      "model.jaffle_shop.stg_supplies": [
        "source.jaffle_shop.ecom.raw_supplies",
      ],
      "model.jaffle_shop.stg_orders": ["source.jaffle_shop.ecom.raw_orders"],
      "model.jaffle_shop.stg_order_items": [
        "source.jaffle_shop.ecom.raw_items",
      ],
      "model.jaffle_shop.stg_locations": ["source.jaffle_shop.ecom.raw_stores"],
      "model.jaffle_shop.supplies": ["model.jaffle_shop.stg_supplies"],
      "model.jaffle_shop.products": ["model.jaffle_shop.stg_products"],
      "model.jaffle_shop.customers": [
        "model.jaffle_shop.orders",
        "model.jaffle_shop.stg_customers",
      ],
      "model.jaffle_shop.orders": [
        "model.jaffle_shop.order_items",
        "model.jaffle_shop.stg_orders",
      ],
      "model.jaffle_shop.metricflow_time_spine": [],
      "model.jaffle_shop.order_items": [
        "model.jaffle_shop.stg_order_items",
        "model.jaffle_shop.stg_orders",
        "model.jaffle_shop.stg_products",
        "model.jaffle_shop.stg_supplies",
      ],
      "model.jaffle_shop.locations": ["model.jaffle_shop.stg_locations"],
      "source.jaffle_shop.ecom.raw_customers": [],
      "source.jaffle_shop.ecom.raw_orders": [],
      "source.jaffle_shop.ecom.raw_items": [],
      "source.jaffle_shop.ecom.raw_stores": [],
      "source.jaffle_shop.ecom.raw_products": [],
      "source.jaffle_shop.ecom.raw_supplies": [],
      "metric.jaffle_shop.lifetime_spend_pretax": [
        "semantic_model.jaffle_shop.customers",
      ],
      "metric.jaffle_shop.count_lifetime_orders": [
        "semantic_model.jaffle_shop.customers",
      ],
      "metric.jaffle_shop.average_order_value": [
        "metric.jaffle_shop.count_lifetime_orders",
        "metric.jaffle_shop.lifetime_spend_pretax",
      ],
      "metric.jaffle_shop.order_total": ["semantic_model.jaffle_shop.orders"],
      "metric.jaffle_shop.new_customer_orders": [
        "semantic_model.jaffle_shop.orders",
      ],
      "metric.jaffle_shop.large_orders": ["semantic_model.jaffle_shop.orders"],
      "metric.jaffle_shop.orders": ["semantic_model.jaffle_shop.orders"],
      "metric.jaffle_shop.food_orders": ["semantic_model.jaffle_shop.orders"],
      "metric.jaffle_shop.drink_orders": ["semantic_model.jaffle_shop.orders"],
      "metric.jaffle_shop.revenue": ["semantic_model.jaffle_shop.order_item"],
      "metric.jaffle_shop.order_cost": ["semantic_model.jaffle_shop.orders"],
      "metric.jaffle_shop.median_revenue": [
        "semantic_model.jaffle_shop.order_item",
      ],
      "metric.jaffle_shop.food_revenue": [
        "semantic_model.jaffle_shop.order_item",
      ],
      "metric.jaffle_shop.drink_revenue": [
        "semantic_model.jaffle_shop.order_item",
      ],
      "metric.jaffle_shop.food_revenue_pct": [
        "metric.jaffle_shop.food_revenue",
        "metric.jaffle_shop.revenue",
      ],
      "metric.jaffle_shop.drink_revenue_pct": [
        "metric.jaffle_shop.drink_revenue",
        "metric.jaffle_shop.revenue",
      ],
      "metric.jaffle_shop.revenue_growth_mom": ["metric.jaffle_shop.revenue"],
      "metric.jaffle_shop.order_gross_profit": [
        "metric.jaffle_shop.order_cost",
        "metric.jaffle_shop.revenue",
      ],
      "metric.jaffle_shop.cumulative_revenue": [
        "semantic_model.jaffle_shop.order_item",
      ],
      "semantic_model.jaffle_shop.products": ["model.jaffle_shop.products"],
      "semantic_model.jaffle_shop.customers": ["model.jaffle_shop.customers"],
      "semantic_model.jaffle_shop.orders": ["model.jaffle_shop.orders"],
      "semantic_model.jaffle_shop.supplies": ["model.jaffle_shop.supplies"],
      "semantic_model.jaffle_shop.locations": ["model.jaffle_shop.locations"],
      "semantic_model.jaffle_shop.order_item": [
        "model.jaffle_shop.order_items",
      ],
    },
    nodes: {
      "model.jaffle_shop.stg_products": {
        id: "model.jaffle_shop.stg_products",
        name: "stg_products",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_PROD",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "view",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "238a14164085db08e1dbab99b81403e0c786165eb364a16a1262d3cd4677f1a6",
        },
        raw_code:
          "with\n\nsource as (\n\n    select * from {{ source('ecom', 'raw_products') }}\n\n),\n\nrenamed as (\n\n    select\n\n        ----------  ids\n        sku as product_id,\n\n        ---------- text\n        name as product_name,\n        type as product_type,\n        description as product_description,\n\n\n        ---------- numerics\n        {{ cents_to_dollars('price') }} as product_price,\n\n        ---------- booleans\n        coalesce(type = 'jaffle', false) as is_food_item,\n\n        coalesce(type = 'beverage', false) as is_drink_item\n\n    from source\n\n)\n\nselect * from renamed",
        columns: {
          PRODUCT_ID: {
            name: "PRODUCT_ID",
            type: "TEXT",
          },
          PRODUCT_NAME: {
            name: "PRODUCT_NAME",
            type: "TEXT",
          },
          PRODUCT_TYPE: {
            name: "PRODUCT_TYPE",
            type: "TEXT",
          },
          PRODUCT_DESCRIPTION: {
            name: "PRODUCT_DESCRIPTION",
            type: "TEXT",
          },
          PRODUCT_PRICE: {
            name: "PRODUCT_PRICE",
            type: "NUMBER",
          },
          IS_FOOD_ITEM: {
            name: "IS_FOOD_ITEM",
            type: "BOOLEAN",
          },
          IS_DRINK_ITEM: {
            name: "IS_DRINK_ITEM",
            type: "BOOLEAN",
          },
        },
      },
      "model.jaffle_shop.stg_customers": {
        id: "model.jaffle_shop.stg_customers",
        name: "stg_customers",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_PROD",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "view",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "37b269b48f94b4526ee48b7123397b9a2f457266e97bf5b876b988cbce9eeef6",
        },
        raw_code:
          "with\n\nsource as (\n\n    select * from {{ source('ecom', 'raw_customers') }}\n\n),\n\nrenamed as (\n\n    select\n\n        ----------  ids\n        id as customer_id,\n\n        ---------- text\n        name as customer_name\n\n    from source\n\n)\n\nselect * from renamed",
        columns: {
          CUSTOMER_ID: {
            name: "CUSTOMER_ID",
            type: "TEXT",
          },
          CUSTOMER_NAME: {
            name: "CUSTOMER_NAME",
            type: "TEXT",
          },
        },
      },
      "model.jaffle_shop.stg_supplies": {
        id: "model.jaffle_shop.stg_supplies",
        name: "stg_supplies",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_PROD",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "view",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "8d346d0f3df3970077f3c92a64d37c26291f7734d5a192479c6f48a89f0f2383",
        },
        raw_code:
          "with\n\nsource as (\n\n    select * from {{ source('ecom', 'raw_supplies') }}\n\n),\n\nrenamed as (\n\n    select\n\n        ----------  ids\n        {{ dbt_utils.generate_surrogate_key(['id', 'sku']) }} as supply_uuid,\n        id as supply_id,\n        sku as product_id,\n\n        ---------- text\n        name as supply_name,\n\n        ---------- numerics\n        {{ cents_to_dollars('cost') }} as supply_cost,\n\n        ---------- booleans\n        perishable as is_perishable_supply\n\n    from source\n\n)\n\nselect * from renamed",
        columns: {
          SUPPLY_UUID: {
            name: "SUPPLY_UUID",
            type: "TEXT",
          },
          SUPPLY_ID: {
            name: "SUPPLY_ID",
            type: "TEXT",
          },
          PRODUCT_ID: {
            name: "PRODUCT_ID",
            type: "TEXT",
          },
          SUPPLY_NAME: {
            name: "SUPPLY_NAME",
            type: "TEXT",
          },
          SUPPLY_COST: {
            name: "SUPPLY_COST",
            type: "NUMBER",
          },
          IS_PERISHABLE_SUPPLY: {
            name: "IS_PERISHABLE_SUPPLY",
            type: "BOOLEAN",
          },
        },
      },
      "model.jaffle_shop.stg_orders": {
        id: "model.jaffle_shop.stg_orders",
        name: "stg_orders",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_PROD",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "view",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "6dddcb97845b3ea5b7390aa17f927087eb490e0bf459b850dc8d271c31da7c35",
        },
        raw_code:
          "with\n\nsource as (\n\n    select * from {{ source('ecom', 'raw_orders') }}\n\n),\n\nrenamed as (\n\n    select\n\n        ----------  ids\n        id as order_id,\n        store_id as location_id,\n        customer as customer_id,\n\n        ---------- numerics\n        subtotal as subtotal_cents,\n        tax_paid as tax_paid_cents,\n        order_total as order_total_cents,\n        {{ cents_to_dollars('subtotal') }} as subtotal,\n        {{ cents_to_dollars('tax_paid') }} as tax_paid,\n        {{ cents_to_dollars('order_total') }} as order_total,\n\n        ---------- timestamps\n        {{ dbt.date_trunc('day','ordered_at') }} as ordered_at\n\n    from source\n\n)\n\nselect * from renamed",
        columns: {
          ORDER_ID: {
            name: "ORDER_ID",
            type: "TEXT",
          },
          LOCATION_ID: {
            name: "LOCATION_ID",
            type: "TEXT",
          },
          CUSTOMER_ID: {
            name: "CUSTOMER_ID",
            type: "TEXT",
          },
          SUBTOTAL_CENTS: {
            name: "SUBTOTAL_CENTS",
            type: "NUMBER",
          },
          TAX_PAID_CENTS: {
            name: "TAX_PAID_CENTS",
            type: "NUMBER",
          },
          ORDER_TOTAL_CENTS: {
            name: "ORDER_TOTAL_CENTS",
            type: "NUMBER",
          },
          SUBTOTAL: {
            name: "SUBTOTAL",
            type: "NUMBER",
          },
          TAX_PAID: {
            name: "TAX_PAID",
            type: "NUMBER",
          },
          ORDER_TOTAL: {
            name: "ORDER_TOTAL",
            type: "NUMBER",
          },
          ORDERED_AT: {
            name: "ORDERED_AT",
            type: "TIMESTAMP_NTZ",
          },
        },
      },
      "model.jaffle_shop.stg_order_items": {
        id: "model.jaffle_shop.stg_order_items",
        name: "stg_order_items",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_PROD",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "view",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "c4551967544f92a36cf257eccdb2c2806343ce82e1c6d96c59adbd9263539ce2",
        },
        raw_code:
          "with\n\nsource as (\n\n    select * from {{ source('ecom', 'raw_items') }}\n\n),\n\nrenamed as (\n\n    select\n\n        ----------  ids\n        id as order_item_id,\n        order_id,\n        sku as product_id\n\n    from source\n\n)\n\nselect * from renamed",
        columns: {
          ORDER_ITEM_ID: {
            name: "ORDER_ITEM_ID",
            type: "TEXT",
          },
          ORDER_ID: {
            name: "ORDER_ID",
            type: "TEXT",
          },
          PRODUCT_ID: {
            name: "PRODUCT_ID",
            type: "TEXT",
          },
        },
      },
      "model.jaffle_shop.stg_locations": {
        id: "model.jaffle_shop.stg_locations",
        name: "stg_locations",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_PROD",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "view",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "d631ac43f7759905404a74c4a2f91590e5d2ff141fee6e24471fc94ccdaeb7ae",
        },
        raw_code:
          "with\n\nsource as (\n\n    select * from {{ source('ecom', 'raw_stores') }}\n\n),\n\nrenamed as (\n\n    select\n\n        ----------  ids\n        id as location_id,\n\n        ---------- text\n        name as location_name,\n\n        ---------- numerics\n        tax_rate,\n\n        ---------- timestamps\n        {{ dbt.date_trunc('day', 'opened_at') }} as opened_date\n\n    from source\n\n)\n\nselect * from renamed",
        columns: {
          LOCATION_ID: {
            name: "LOCATION_ID",
            type: "TEXT",
          },
          LOCATION_NAME: {
            name: "LOCATION_NAME",
            type: "TEXT",
          },
          TAX_RATE: {
            name: "TAX_RATE",
            type: "FLOAT",
          },
          OPENED_DATE: {
            name: "OPENED_DATE",
            type: "TIMESTAMP_NTZ",
          },
        },
      },
      "model.jaffle_shop.supplies": {
        id: "model.jaffle_shop.supplies",
        name: "supplies",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_PROD",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "table",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "a9fb647ed0dd39f0cee1167fcd0d621fcead71cdd47dd68daef116e81797d7bd",
        },
        raw_code:
          "with\n\nsupplies as (\n\n    select * from {{ ref('stg_supplies') }}\n\n)\n\nselect * from supplies",
        columns: {
          SUPPLY_UUID: {
            name: "SUPPLY_UUID",
            type: "TEXT",
          },
          SUPPLY_ID: {
            name: "SUPPLY_ID",
            type: "TEXT",
          },
          PRODUCT_ID: {
            name: "PRODUCT_ID",
            type: "TEXT",
          },
          SUPPLY_NAME: {
            name: "SUPPLY_NAME",
            type: "TEXT",
          },
          SUPPLY_COST: {
            name: "SUPPLY_COST",
            type: "NUMBER",
          },
          IS_PERISHABLE_SUPPLY: {
            name: "IS_PERISHABLE_SUPPLY",
            type: "BOOLEAN",
          },
        },
      },
      "model.jaffle_shop.products": {
        id: "model.jaffle_shop.products",
        name: "products",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_PROD",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "table",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "b02b440e9c260bbf83dbff957eacc3edf778d197c63a22da56fae7c554462092",
        },
        raw_code:
          "with\n\nproducts as (\n\n    select * from {{ ref('stg_products') }}\n\n)\n\nselect * from products",
        columns: {
          PRODUCT_ID: {
            name: "PRODUCT_ID",
            type: "TEXT",
          },
          PRODUCT_NAME: {
            name: "PRODUCT_NAME",
            type: "TEXT",
          },
          PRODUCT_TYPE: {
            name: "PRODUCT_TYPE",
            type: "TEXT",
          },
          PRODUCT_DESCRIPTION: {
            name: "PRODUCT_DESCRIPTION",
            type: "TEXT",
          },
          PRODUCT_PRICE: {
            name: "PRODUCT_PRICE",
            type: "NUMBER",
          },
          IS_FOOD_ITEM: {
            name: "IS_FOOD_ITEM",
            type: "BOOLEAN",
          },
          IS_DRINK_ITEM: {
            name: "IS_DRINK_ITEM",
            type: "BOOLEAN",
          },
        },
      },
      "model.jaffle_shop.customers": {
        id: "model.jaffle_shop.customers",
        name: "customers",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_PROD",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "table",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "664488ec4c2dc2e6b48f35ec05d81258c5c7716af3f044435815046378f1d224",
        },
        raw_code:
          "with\n\ncustomers as (\n\n    select * from {{ ref('stg_customers') }}\n\n),\n\norders as (\n\n    select * from {{ ref('orders') }}\n\n),\n\ncustomer_orders_summary as (\n\n    select\n        orders.customer_id,\n\n        count(distinct orders.order_id) as count_lifetime_orders,\n        count(distinct orders.order_id) > 1 as is_repeat_buyer,\n        min(orders.ordered_at) as first_ordered_at,\n        max(orders.ordered_at) as last_ordered_at,\n        sum(orders.subtotal) as lifetime_spend_pretax,\n        sum(orders.tax_paid) as lifetime_tax_paid,\n        sum(orders.order_total) as lifetime_spend\n\n    from orders\n\n    group by 1\n\n),\n\njoined as (\n\n    select\n        customers.*,\n\n        customer_orders_summary.count_lifetime_orders,\n        customer_orders_summary.first_ordered_at,\n        customer_orders_summary.last_ordered_at,\n        customer_orders_summary.lifetime_spend_pretax,\n        customer_orders_summary.lifetime_tax_paid,\n        customer_orders_summary.lifetime_spend,\n\n        case\n            when customer_orders_summary.is_repeat_buyer then 'returning'\n            else 'new'\n        end as customer_type\n\n    from customers\n\n    left join customer_orders_summary\n        on customers.customer_id = customer_orders_summary.customer_id\n\n)\n\nselect * from joined",
        columns: {
          CUSTOMER_ID: {
            name: "CUSTOMER_ID",
            type: "TEXT",
          },
          CUSTOMER_NAME: {
            name: "CUSTOMER_NAME",
            type: "TEXT",
          },
          COUNT_LIFETIME_ORDERS: {
            name: "COUNT_LIFETIME_ORDERS",
            type: "NUMBER",
          },
          FIRST_ORDERED_AT: {
            name: "FIRST_ORDERED_AT",
            type: "TIMESTAMP_NTZ",
          },
          LAST_ORDERED_AT: {
            name: "LAST_ORDERED_AT",
            type: "TIMESTAMP_NTZ",
          },
          LIFETIME_SPEND_PRETAX: {
            name: "LIFETIME_SPEND_PRETAX",
            type: "NUMBER",
          },
          LIFETIME_TAX_PAID: {
            name: "LIFETIME_TAX_PAID",
            type: "NUMBER",
          },
          LIFETIME_SPEND: {
            name: "LIFETIME_SPEND",
            type: "NUMBER",
          },
          CUSTOMER_TYPE: {
            name: "CUSTOMER_TYPE",
            type: "TEXT",
          },
        },
      },
      "model.jaffle_shop.orders": {
        id: "model.jaffle_shop.orders",
        name: "orders",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_PROD",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "table",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "672fab3cb996bc7652da3f751da1f11f2674290bb3fdd3b5ed4fc35b0bbb6460",
        },
        raw_code:
          "with\n\norders as (\n\n    select * from {{ ref('stg_orders') }}\n\n),\n\norder_items as (\n\n    select * from {{ ref('order_items') }}\n\n),\n\norder_items_summary as (\n\n    select\n        order_id,\n\n        sum(supply_cost) as order_cost,\n        sum(product_price) as order_items_subtotal,\n        count(order_item_id) as count_order_items,\n        sum(\n            case\n                when is_food_item then 1\n                else 0\n            end\n        ) as count_food_items,\n        sum(\n            case\n                when is_drink_item then 1\n                else 0\n            end\n        ) as count_drink_items\n\n    from order_items\n\n    group by 1\n\n),\n\ncompute_booleans as (\n\n    select\n        orders.*,\n\n        order_items_summary.order_cost,\n        order_items_summary.order_items_subtotal,\n        order_items_summary.count_food_items,\n        order_items_summary.count_drink_items,\n        order_items_summary.count_order_items,\n        order_items_summary.count_food_items > 0 as is_food_order,\n        order_items_summary.count_drink_items > 0 as is_drink_order\n\n    from orders\n\n    left join\n        order_items_summary\n        on orders.order_id = order_items_summary.order_id\n\n),\n\ncustomer_order_count as (\n\n    select\n        *,\n\n        row_number() over (\n            partition by customer_id\n            order by ordered_at asc\n        ) as customer_order_number\n\n    from compute_booleans\n\n)\n\nselect * from customer_order_count",
        columns: {
          ORDER_ID: {
            name: "ORDER_ID",
            type: "TEXT",
          },
          LOCATION_ID: {
            name: "LOCATION_ID",
            type: "TEXT",
          },
          CUSTOMER_ID: {
            name: "CUSTOMER_ID",
            type: "TEXT",
          },
          SUBTOTAL_CENTS: {
            name: "SUBTOTAL_CENTS",
            type: "NUMBER",
          },
          TAX_PAID_CENTS: {
            name: "TAX_PAID_CENTS",
            type: "NUMBER",
          },
          ORDER_TOTAL_CENTS: {
            name: "ORDER_TOTAL_CENTS",
            type: "NUMBER",
          },
          SUBTOTAL: {
            name: "SUBTOTAL",
            type: "NUMBER",
          },
          TAX_PAID: {
            name: "TAX_PAID",
            type: "NUMBER",
          },
          ORDER_TOTAL: {
            name: "ORDER_TOTAL",
            type: "NUMBER",
          },
          ORDERED_AT: {
            name: "ORDERED_AT",
            type: "TIMESTAMP_NTZ",
          },
          ORDER_COST: {
            name: "ORDER_COST",
            type: "NUMBER",
          },
          ORDER_ITEMS_SUBTOTAL: {
            name: "ORDER_ITEMS_SUBTOTAL",
            type: "NUMBER",
          },
          COUNT_FOOD_ITEMS: {
            name: "COUNT_FOOD_ITEMS",
            type: "NUMBER",
          },
          COUNT_DRINK_ITEMS: {
            name: "COUNT_DRINK_ITEMS",
            type: "NUMBER",
          },
          COUNT_ORDER_ITEMS: {
            name: "COUNT_ORDER_ITEMS",
            type: "NUMBER",
          },
          IS_FOOD_ORDER: {
            name: "IS_FOOD_ORDER",
            type: "BOOLEAN",
          },
          IS_DRINK_ORDER: {
            name: "IS_DRINK_ORDER",
            type: "BOOLEAN",
          },
          CUSTOMER_ORDER_NUMBER: {
            name: "CUSTOMER_ORDER_NUMBER",
            type: "NUMBER",
          },
        },
      },
      "model.jaffle_shop.metricflow_time_spine": {
        id: "model.jaffle_shop.metricflow_time_spine",
        name: "metricflow_time_spine",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_PROD",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "table",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "1c1814c8aaffb1e0562f046f6e8ced94c7eeb536f67a794d4f7a55fa8a1a9109",
        },
        raw_code:
          "-- metricflow_time_spine.sql\nwith\n\ndays as (\n\n    --for BQ adapters use \"DATE('01/01/2000','mm/dd/yyyy')\"\n    {{ dbt_date.get_base_dates(n_dateparts=365*10, datepart=\"day\") }}\n\n),\n\ncast_to_date as (\n\n    select cast(date_day as date) as date_day\n\n    from days\n\n)\n\nselect * from cast_to_date",
        columns: {
          DATE_DAY: {
            name: "DATE_DAY",
            type: "DATE",
          },
        },
      },
      "model.jaffle_shop.order_items": {
        id: "model.jaffle_shop.order_items",
        name: "order_items",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_PROD",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "table",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "f6268350d0266dc7b23e662349e4c94a9e1d9f4689765055ba7c5ea07d82a06c",
        },
        raw_code:
          "with\n\norder_items as (\n\n    select * from {{ ref('stg_order_items') }}\n\n),\n\n\norders as (\n\n    select * from {{ ref('stg_orders') }}\n\n),\n\nproducts as (\n\n    select * from {{ ref('stg_products') }}\n\n),\n\nsupplies as (\n\n    select * from {{ ref('stg_supplies') }}\n\n),\n\norder_supplies_summary as (\n\n    select\n        product_id,\n\n        sum(supply_cost) as supply_cost\n\n    from supplies\n\n    group by 1\n\n),\n\njoined as (\n\n    select\n        order_items.*,\n\n        orders.ordered_at,\n\n        products.product_name,\n        products.product_price,\n        products.is_food_item,\n        products.is_drink_item,\n\n        order_supplies_summary.supply_cost\n\n    from order_items\n\n    left join orders on order_items.order_id = orders.order_id\n\n    left join products on order_items.product_id = products.product_id\n\n    left join order_supplies_summary\n        on order_items.product_id = order_supplies_summary.product_id\n\n)\n\nselect * from joined",
        columns: {
          ORDER_ITEM_ID: {
            name: "ORDER_ITEM_ID",
            type: "TEXT",
          },
          ORDER_ID: {
            name: "ORDER_ID",
            type: "TEXT",
          },
          PRODUCT_ID: {
            name: "PRODUCT_ID",
            type: "TEXT",
          },
          ORDERED_AT: {
            name: "ORDERED_AT",
            type: "TIMESTAMP_NTZ",
          },
          PRODUCT_NAME: {
            name: "PRODUCT_NAME",
            type: "TEXT",
          },
          PRODUCT_PRICE: {
            name: "PRODUCT_PRICE",
            type: "NUMBER",
          },
          IS_FOOD_ITEM: {
            name: "IS_FOOD_ITEM",
            type: "BOOLEAN",
          },
          IS_DRINK_ITEM: {
            name: "IS_DRINK_ITEM",
            type: "BOOLEAN",
          },
          SUPPLY_COST: {
            name: "SUPPLY_COST",
            type: "NUMBER",
          },
        },
      },
      "model.jaffle_shop.locations": {
        id: "model.jaffle_shop.locations",
        name: "locations",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_PROD",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "table",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "01e79fced00fb035440afc48077281f3c01163cfb6ae19ccbc4d73cc1ed7d2cf",
        },
        raw_code:
          "with\n\nlocations as (\n\n    select * from {{ ref('stg_locations') }}\n\n)\n\nselect * from locations",
        columns: {
          LOCATION_ID: {
            name: "LOCATION_ID",
            type: "TEXT",
          },
          LOCATION_NAME: {
            name: "LOCATION_NAME",
            type: "TEXT",
          },
          TAX_RATE: {
            name: "TAX_RATE",
            type: "FLOAT",
          },
          OPENED_DATE: {
            name: "OPENED_DATE",
            type: "TIMESTAMP_NTZ",
          },
        },
      },
      "source.jaffle_shop.ecom.raw_customers": {
        id: "source.jaffle_shop.ecom.raw_customers",
        name: "raw_customers",
        source_name: "ecom",
        resource_type: "source",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          event_time: null,
          freshness: {
            warn_after: {
              count: null,
              period: null,
            },
            error_after: {
              count: null,
              period: null,
            },
            filter: null,
          },
          loaded_at_field: null,
          loaded_at_query: null,
          meta: {},
          tags: [],
        },
        columns: {
          ID: {
            name: "ID",
            type: "TEXT",
          },
          NAME: {
            name: "NAME",
            type: "TEXT",
          },
        },
      },
      "source.jaffle_shop.ecom.raw_orders": {
        id: "source.jaffle_shop.ecom.raw_orders",
        name: "raw_orders",
        source_name: "ecom",
        resource_type: "source",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          event_time: null,
          freshness: {
            warn_after: {
              count: null,
              period: null,
            },
            error_after: {
              count: null,
              period: null,
            },
            filter: null,
          },
          loaded_at_field: "ordered_at",
          loaded_at_query: null,
          meta: {},
          tags: [],
        },
        columns: {
          ID: {
            name: "ID",
            type: "TEXT",
          },
          CUSTOMER: {
            name: "CUSTOMER",
            type: "TEXT",
          },
          ORDERED_AT: {
            name: "ORDERED_AT",
            type: "TIMESTAMP_NTZ",
          },
          STORE_ID: {
            name: "STORE_ID",
            type: "TEXT",
          },
          SUBTOTAL: {
            name: "SUBTOTAL",
            type: "NUMBER",
          },
          TAX_PAID: {
            name: "TAX_PAID",
            type: "NUMBER",
          },
          ORDER_TOTAL: {
            name: "ORDER_TOTAL",
            type: "NUMBER",
          },
        },
      },
      "source.jaffle_shop.ecom.raw_items": {
        id: "source.jaffle_shop.ecom.raw_items",
        name: "raw_items",
        source_name: "ecom",
        resource_type: "source",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          event_time: null,
          freshness: {
            warn_after: {
              count: null,
              period: null,
            },
            error_after: {
              count: null,
              period: null,
            },
            filter: null,
          },
          loaded_at_field: null,
          loaded_at_query: null,
          meta: {},
          tags: [],
        },
        columns: {
          ID: {
            name: "ID",
            type: "TEXT",
          },
          ORDER_ID: {
            name: "ORDER_ID",
            type: "TEXT",
          },
          SKU: {
            name: "SKU",
            type: "TEXT",
          },
        },
      },
      "source.jaffle_shop.ecom.raw_stores": {
        id: "source.jaffle_shop.ecom.raw_stores",
        name: "raw_stores",
        source_name: "ecom",
        resource_type: "source",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          event_time: null,
          freshness: {
            warn_after: {
              count: null,
              period: null,
            },
            error_after: {
              count: null,
              period: null,
            },
            filter: null,
          },
          loaded_at_field: "opened_at",
          loaded_at_query: null,
          meta: {},
          tags: [],
        },
        columns: {
          ID: {
            name: "ID",
            type: "TEXT",
          },
          NAME: {
            name: "NAME",
            type: "TEXT",
          },
          OPENED_AT: {
            name: "OPENED_AT",
            type: "TIMESTAMP_NTZ",
          },
          TAX_RATE: {
            name: "TAX_RATE",
            type: "FLOAT",
          },
        },
      },
      "source.jaffle_shop.ecom.raw_products": {
        id: "source.jaffle_shop.ecom.raw_products",
        name: "raw_products",
        source_name: "ecom",
        resource_type: "source",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          event_time: null,
          freshness: {
            warn_after: {
              count: null,
              period: null,
            },
            error_after: {
              count: null,
              period: null,
            },
            filter: null,
          },
          loaded_at_field: null,
          loaded_at_query: null,
          meta: {},
          tags: [],
        },
        columns: {
          SKU: {
            name: "SKU",
            type: "TEXT",
          },
          NAME: {
            name: "NAME",
            type: "TEXT",
          },
          TYPE: {
            name: "TYPE",
            type: "TEXT",
          },
          PRICE: {
            name: "PRICE",
            type: "NUMBER",
          },
          DESCRIPTION: {
            name: "DESCRIPTION",
            type: "TEXT",
          },
        },
      },
      "source.jaffle_shop.ecom.raw_supplies": {
        id: "source.jaffle_shop.ecom.raw_supplies",
        name: "raw_supplies",
        source_name: "ecom",
        resource_type: "source",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          event_time: null,
          freshness: {
            warn_after: {
              count: null,
              period: null,
            },
            error_after: {
              count: null,
              period: null,
            },
            filter: null,
          },
          loaded_at_field: null,
          loaded_at_query: null,
          meta: {},
          tags: [],
        },
        columns: {
          ID: {
            name: "ID",
            type: "TEXT",
          },
          NAME: {
            name: "NAME",
            type: "TEXT",
          },
          COST: {
            name: "COST",
            type: "NUMBER",
          },
          PERISHABLE: {
            name: "PERISHABLE",
            type: "BOOLEAN",
          },
          SKU: {
            name: "SKU",
            type: "TEXT",
          },
        },
      },
      "metric.jaffle_shop.lifetime_spend_pretax": {
        id: "metric.jaffle_shop.lifetime_spend_pretax",
        name: "lifetime_spend_pretax",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.count_lifetime_orders": {
        id: "metric.jaffle_shop.count_lifetime_orders",
        name: "count_lifetime_orders",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.average_order_value": {
        id: "metric.jaffle_shop.average_order_value",
        name: "average_order_value",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.order_total": {
        id: "metric.jaffle_shop.order_total",
        name: "order_total",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.new_customer_orders": {
        id: "metric.jaffle_shop.new_customer_orders",
        name: "new_customer_orders",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.large_orders": {
        id: "metric.jaffle_shop.large_orders",
        name: "large_orders",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.orders": {
        id: "metric.jaffle_shop.orders",
        name: "orders",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.food_orders": {
        id: "metric.jaffle_shop.food_orders",
        name: "food_orders",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.drink_orders": {
        id: "metric.jaffle_shop.drink_orders",
        name: "drink_orders",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.revenue": {
        id: "metric.jaffle_shop.revenue",
        name: "revenue",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.order_cost": {
        id: "metric.jaffle_shop.order_cost",
        name: "order_cost",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.median_revenue": {
        id: "metric.jaffle_shop.median_revenue",
        name: "median_revenue",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.food_revenue": {
        id: "metric.jaffle_shop.food_revenue",
        name: "food_revenue",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.drink_revenue": {
        id: "metric.jaffle_shop.drink_revenue",
        name: "drink_revenue",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.food_revenue_pct": {
        id: "metric.jaffle_shop.food_revenue_pct",
        name: "food_revenue_pct",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.drink_revenue_pct": {
        id: "metric.jaffle_shop.drink_revenue_pct",
        name: "drink_revenue_pct",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.revenue_growth_mom": {
        id: "metric.jaffle_shop.revenue_growth_mom",
        name: "revenue_growth_mom",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.order_gross_profit": {
        id: "metric.jaffle_shop.order_gross_profit",
        name: "order_gross_profit",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.cumulative_revenue": {
        id: "metric.jaffle_shop.cumulative_revenue",
        name: "cumulative_revenue",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "semantic_model.jaffle_shop.products": {
        id: "semantic_model.jaffle_shop.products",
        name: "products",
        resource_type: "semantic_model",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "semantic_model.jaffle_shop.customers": {
        id: "semantic_model.jaffle_shop.customers",
        name: "customers",
        resource_type: "semantic_model",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "semantic_model.jaffle_shop.orders": {
        id: "semantic_model.jaffle_shop.orders",
        name: "orders",
        resource_type: "semantic_model",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "semantic_model.jaffle_shop.supplies": {
        id: "semantic_model.jaffle_shop.supplies",
        name: "supplies",
        resource_type: "semantic_model",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "semantic_model.jaffle_shop.locations": {
        id: "semantic_model.jaffle_shop.locations",
        name: "locations",
        resource_type: "semantic_model",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "semantic_model.jaffle_shop.order_item": {
        id: "semantic_model.jaffle_shop.order_item",
        name: "order_item",
        resource_type: "semantic_model",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
    },
    manifest_metadata: {
      dbt_schema_version: "https://schemas.getdbt.com/dbt/manifest/v12.json",
      dbt_version: "1.10.15",
      generated_at: "2025-12-12T02:38:43.980911Z",
      invocation_id: "755150e7-2f48-483f-bcf1-fdc38def4807",
      invocation_started_at: "2025-12-10T06:49:16.750092Z",
      env: {},
      project_name: "jaffle_shop",
      project_id: "06e5b98c2db46f8a72cc4f66410e9b3b",
      user_id: "98a1429d-26ce-4378-bc71-6d84ee1ef09d",
      send_anonymous_usage_stats: true,
      adapter_type: "snowflake",
      quoting: {
        database: false,
        schema: false,
        identifier: false,
        column: null,
      },
    },
    catalog_metadata: {
      dbt_schema_version: "https://schemas.getdbt.com/dbt/catalog/v1.json",
      dbt_version: "1.10.15",
      generated_at: "2025-12-12T02:38:59.367572Z",
      invocation_id: "755150e7-2f48-483f-bcf1-fdc38def4807",
      invocation_started_at: "2025-12-12T02:38:43.301765Z",
      env: {},
    },
  },
  current: {
    parent_map: {
      "model.jaffle_shop.stg_products": [
        "source.jaffle_shop.ecom.raw_products",
      ],
      "model.jaffle_shop.stg_customers": [
        "source.jaffle_shop.ecom.raw_customers",
      ],
      "model.jaffle_shop.stg_supplies": [
        "source.jaffle_shop.ecom.raw_supplies",
      ],
      "model.jaffle_shop.stg_orders": ["source.jaffle_shop.ecom.raw_orders"],
      "model.jaffle_shop.stg_order_items": [
        "source.jaffle_shop.ecom.raw_items",
      ],
      "model.jaffle_shop.stg_locations": ["source.jaffle_shop.ecom.raw_stores"],
      "model.jaffle_shop.supplies": ["model.jaffle_shop.stg_supplies"],
      "model.jaffle_shop.products": ["model.jaffle_shop.stg_products"],
      "model.jaffle_shop.customers": [
        "model.jaffle_shop.orders",
        "model.jaffle_shop.stg_customers",
      ],
      "model.jaffle_shop.orders": [
        "model.jaffle_shop.order_items",
        "model.jaffle_shop.stg_orders",
      ],
      "model.jaffle_shop.metricflow_time_spine": [],
      "model.jaffle_shop.order_items": [
        "model.jaffle_shop.stg_order_items",
        "model.jaffle_shop.stg_orders",
        "model.jaffle_shop.stg_products",
        "model.jaffle_shop.stg_supplies",
      ],
      "model.jaffle_shop.locations": ["model.jaffle_shop.stg_locations"],
      "source.jaffle_shop.ecom.raw_customers": [],
      "source.jaffle_shop.ecom.raw_orders": [],
      "source.jaffle_shop.ecom.raw_items": [],
      "source.jaffle_shop.ecom.raw_stores": [],
      "source.jaffle_shop.ecom.raw_products": [],
      "source.jaffle_shop.ecom.raw_supplies": [],
      "metric.jaffle_shop.lifetime_spend_pretax": [
        "semantic_model.jaffle_shop.customers",
      ],
      "metric.jaffle_shop.count_lifetime_orders": [
        "semantic_model.jaffle_shop.customers",
      ],
      "metric.jaffle_shop.average_order_value": [
        "metric.jaffle_shop.count_lifetime_orders",
        "metric.jaffle_shop.lifetime_spend_pretax",
      ],
      "metric.jaffle_shop.order_total": ["semantic_model.jaffle_shop.orders"],
      "metric.jaffle_shop.new_customer_orders": [
        "semantic_model.jaffle_shop.orders",
      ],
      "metric.jaffle_shop.large_orders": ["semantic_model.jaffle_shop.orders"],
      "metric.jaffle_shop.orders": ["semantic_model.jaffle_shop.orders"],
      "metric.jaffle_shop.food_orders": ["semantic_model.jaffle_shop.orders"],
      "metric.jaffle_shop.drink_orders": ["semantic_model.jaffle_shop.orders"],
      "metric.jaffle_shop.revenue": ["semantic_model.jaffle_shop.order_item"],
      "metric.jaffle_shop.order_cost": ["semantic_model.jaffle_shop.orders"],
      "metric.jaffle_shop.median_revenue": [
        "semantic_model.jaffle_shop.order_item",
      ],
      "metric.jaffle_shop.food_revenue": [
        "semantic_model.jaffle_shop.order_item",
      ],
      "metric.jaffle_shop.drink_revenue": [
        "semantic_model.jaffle_shop.order_item",
      ],
      "metric.jaffle_shop.food_revenue_pct": [
        "metric.jaffle_shop.food_revenue",
        "metric.jaffle_shop.revenue",
      ],
      "metric.jaffle_shop.drink_revenue_pct": [
        "metric.jaffle_shop.drink_revenue",
        "metric.jaffle_shop.revenue",
      ],
      "metric.jaffle_shop.revenue_growth_mom": ["metric.jaffle_shop.revenue"],
      "metric.jaffle_shop.order_gross_profit": [
        "metric.jaffle_shop.order_cost",
        "metric.jaffle_shop.revenue",
      ],
      "metric.jaffle_shop.cumulative_revenue": [
        "semantic_model.jaffle_shop.order_item",
      ],
      "semantic_model.jaffle_shop.products": ["model.jaffle_shop.products"],
      "semantic_model.jaffle_shop.customers": ["model.jaffle_shop.customers"],
      "semantic_model.jaffle_shop.orders": ["model.jaffle_shop.orders"],
      "semantic_model.jaffle_shop.supplies": ["model.jaffle_shop.supplies"],
      "semantic_model.jaffle_shop.locations": ["model.jaffle_shop.locations"],
      "semantic_model.jaffle_shop.order_item": [
        "model.jaffle_shop.order_items",
      ],
    },
    nodes: {
      "model.jaffle_shop.stg_products": {
        id: "model.jaffle_shop.stg_products",
        name: "stg_products",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_DEV",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "view",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "238a14164085db08e1dbab99b81403e0c786165eb364a16a1262d3cd4677f1a6",
        },
        raw_code:
          "with\n\nsource as (\n\n    select * from {{ source('ecom', 'raw_products') }}\n\n),\n\nrenamed as (\n\n    select\n\n        ----------  ids\n        sku as product_id,\n\n        ---------- text\n        name as product_name,\n        type as product_type,\n        description as product_description,\n\n\n        ---------- numerics\n        {{ cents_to_dollars('price') }} as product_price,\n\n        ---------- booleans\n        coalesce(type = 'jaffle', false) as is_food_item,\n\n        coalesce(type = 'beverage', false) as is_drink_item\n\n    from source\n\n)\n\nselect * from renamed",
        columns: {
          PRODUCT_ID: {
            name: "PRODUCT_ID",
            type: "TEXT",
          },
          PRODUCT_NAME: {
            name: "PRODUCT_NAME",
            type: "TEXT",
          },
          PRODUCT_TYPE: {
            name: "PRODUCT_TYPE",
            type: "TEXT",
          },
          PRODUCT_DESCRIPTION: {
            name: "PRODUCT_DESCRIPTION",
            type: "TEXT",
          },
          PRODUCT_PRICE: {
            name: "PRODUCT_PRICE",
            type: "NUMBER",
          },
          IS_FOOD_ITEM: {
            name: "IS_FOOD_ITEM",
            type: "BOOLEAN",
          },
          IS_DRINK_ITEM: {
            name: "IS_DRINK_ITEM",
            type: "BOOLEAN",
          },
        },
      },
      "model.jaffle_shop.stg_customers": {
        id: "model.jaffle_shop.stg_customers",
        name: "stg_customers",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_DEV",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "view",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "37b269b48f94b4526ee48b7123397b9a2f457266e97bf5b876b988cbce9eeef6",
        },
        raw_code:
          "with\n\nsource as (\n\n    select * from {{ source('ecom', 'raw_customers') }}\n\n),\n\nrenamed as (\n\n    select\n\n        ----------  ids\n        id as customer_id,\n\n        ---------- text\n        name as customer_name\n\n    from source\n\n)\n\nselect * from renamed",
        columns: {
          CUSTOMER_ID: {
            name: "CUSTOMER_ID",
            type: "TEXT",
          },
          CUSTOMER_NAME: {
            name: "CUSTOMER_NAME",
            type: "TEXT",
          },
        },
      },
      "model.jaffle_shop.stg_supplies": {
        id: "model.jaffle_shop.stg_supplies",
        name: "stg_supplies",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_DEV",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "view",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "8d346d0f3df3970077f3c92a64d37c26291f7734d5a192479c6f48a89f0f2383",
        },
        raw_code:
          "with\n\nsource as (\n\n    select * from {{ source('ecom', 'raw_supplies') }}\n\n),\n\nrenamed as (\n\n    select\n\n        ----------  ids\n        {{ dbt_utils.generate_surrogate_key(['id', 'sku']) }} as supply_uuid,\n        id as supply_id,\n        sku as product_id,\n\n        ---------- text\n        name as supply_name,\n\n        ---------- numerics\n        {{ cents_to_dollars('cost') }} as supply_cost,\n\n        ---------- booleans\n        perishable as is_perishable_supply\n\n    from source\n\n)\n\nselect * from renamed",
        columns: {
          SUPPLY_UUID: {
            name: "SUPPLY_UUID",
            type: "TEXT",
          },
          SUPPLY_ID: {
            name: "SUPPLY_ID",
            type: "TEXT",
          },
          PRODUCT_ID: {
            name: "PRODUCT_ID",
            type: "TEXT",
          },
          SUPPLY_NAME: {
            name: "SUPPLY_NAME",
            type: "TEXT",
          },
          SUPPLY_COST: {
            name: "SUPPLY_COST",
            type: "NUMBER",
          },
          IS_PERISHABLE_SUPPLY: {
            name: "IS_PERISHABLE_SUPPLY",
            type: "BOOLEAN",
          },
        },
      },
      "model.jaffle_shop.stg_orders": {
        id: "model.jaffle_shop.stg_orders",
        name: "stg_orders",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_DEV",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "view",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "6dddcb97845b3ea5b7390aa17f927087eb490e0bf459b850dc8d271c31da7c35",
        },
        raw_code:
          "with\n\nsource as (\n\n    select * from {{ source('ecom', 'raw_orders') }}\n\n),\n\nrenamed as (\n\n    select\n\n        ----------  ids\n        id as order_id,\n        store_id as location_id,\n        customer as customer_id,\n\n        ---------- numerics\n        subtotal as subtotal_cents,\n        tax_paid as tax_paid_cents,\n        order_total as order_total_cents,\n        {{ cents_to_dollars('subtotal') }} as subtotal,\n        {{ cents_to_dollars('tax_paid') }} as tax_paid,\n        {{ cents_to_dollars('order_total') }} as order_total,\n\n        ---------- timestamps\n        {{ dbt.date_trunc('day','ordered_at') }} as ordered_at\n\n    from source\n\n)\n\nselect * from renamed",
        columns: {
          ORDER_ID: {
            name: "ORDER_ID",
            type: "TEXT",
          },
          LOCATION_ID: {
            name: "LOCATION_ID",
            type: "TEXT",
          },
          CUSTOMER_ID: {
            name: "CUSTOMER_ID",
            type: "TEXT",
          },
          SUBTOTAL_CENTS: {
            name: "SUBTOTAL_CENTS",
            type: "NUMBER",
          },
          TAX_PAID_CENTS: {
            name: "TAX_PAID_CENTS",
            type: "NUMBER",
          },
          ORDER_TOTAL_CENTS: {
            name: "ORDER_TOTAL_CENTS",
            type: "NUMBER",
          },
          SUBTOTAL: {
            name: "SUBTOTAL",
            type: "NUMBER",
          },
          TAX_PAID: {
            name: "TAX_PAID",
            type: "NUMBER",
          },
          ORDER_TOTAL: {
            name: "ORDER_TOTAL",
            type: "NUMBER",
          },
          ORDERED_AT: {
            name: "ORDERED_AT",
            type: "TIMESTAMP_NTZ",
          },
        },
      },
      "model.jaffle_shop.stg_order_items": {
        id: "model.jaffle_shop.stg_order_items",
        name: "stg_order_items",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_DEV",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "view",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "c4551967544f92a36cf257eccdb2c2806343ce82e1c6d96c59adbd9263539ce2",
        },
        raw_code:
          "with\n\nsource as (\n\n    select * from {{ source('ecom', 'raw_items') }}\n\n),\n\nrenamed as (\n\n    select\n\n        ----------  ids\n        id as order_item_id,\n        order_id,\n        sku as product_id\n\n    from source\n\n)\n\nselect * from renamed",
        columns: {
          ORDER_ITEM_ID: {
            name: "ORDER_ITEM_ID",
            type: "TEXT",
          },
          ORDER_ID: {
            name: "ORDER_ID",
            type: "TEXT",
          },
          PRODUCT_ID: {
            name: "PRODUCT_ID",
            type: "TEXT",
          },
        },
      },
      "model.jaffle_shop.stg_locations": {
        id: "model.jaffle_shop.stg_locations",
        name: "stg_locations",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_DEV",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "view",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "d631ac43f7759905404a74c4a2f91590e5d2ff141fee6e24471fc94ccdaeb7ae",
        },
        raw_code:
          "with\n\nsource as (\n\n    select * from {{ source('ecom', 'raw_stores') }}\n\n),\n\nrenamed as (\n\n    select\n\n        ----------  ids\n        id as location_id,\n\n        ---------- text\n        name as location_name,\n\n        ---------- numerics\n        tax_rate,\n\n        ---------- timestamps\n        {{ dbt.date_trunc('day', 'opened_at') }} as opened_date\n\n    from source\n\n)\n\nselect * from renamed",
        columns: {
          LOCATION_ID: {
            name: "LOCATION_ID",
            type: "TEXT",
          },
          LOCATION_NAME: {
            name: "LOCATION_NAME",
            type: "TEXT",
          },
          TAX_RATE: {
            name: "TAX_RATE",
            type: "FLOAT",
          },
          OPENED_DATE: {
            name: "OPENED_DATE",
            type: "TIMESTAMP_NTZ",
          },
        },
      },
      "model.jaffle_shop.supplies": {
        id: "model.jaffle_shop.supplies",
        name: "supplies",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_DEV",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "table",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "a9fb647ed0dd39f0cee1167fcd0d621fcead71cdd47dd68daef116e81797d7bd",
        },
        raw_code:
          "with\n\nsupplies as (\n\n    select * from {{ ref('stg_supplies') }}\n\n)\n\nselect * from supplies",
        columns: {
          SUPPLY_UUID: {
            name: "SUPPLY_UUID",
            type: "TEXT",
          },
          SUPPLY_ID: {
            name: "SUPPLY_ID",
            type: "TEXT",
          },
          PRODUCT_ID: {
            name: "PRODUCT_ID",
            type: "TEXT",
          },
          SUPPLY_NAME: {
            name: "SUPPLY_NAME",
            type: "TEXT",
          },
          SUPPLY_COST: {
            name: "SUPPLY_COST",
            type: "NUMBER",
          },
          IS_PERISHABLE_SUPPLY: {
            name: "IS_PERISHABLE_SUPPLY",
            type: "BOOLEAN",
          },
        },
      },
      "model.jaffle_shop.products": {
        id: "model.jaffle_shop.products",
        name: "products",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_DEV",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "table",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "b02b440e9c260bbf83dbff957eacc3edf778d197c63a22da56fae7c554462092",
        },
        raw_code:
          "with\n\nproducts as (\n\n    select * from {{ ref('stg_products') }}\n\n)\n\nselect * from products",
        columns: {
          PRODUCT_ID: {
            name: "PRODUCT_ID",
            type: "TEXT",
          },
          PRODUCT_NAME: {
            name: "PRODUCT_NAME",
            type: "TEXT",
          },
          PRODUCT_TYPE: {
            name: "PRODUCT_TYPE",
            type: "TEXT",
          },
          PRODUCT_DESCRIPTION: {
            name: "PRODUCT_DESCRIPTION",
            type: "TEXT",
          },
          PRODUCT_PRICE: {
            name: "PRODUCT_PRICE",
            type: "NUMBER",
          },
          IS_FOOD_ITEM: {
            name: "IS_FOOD_ITEM",
            type: "BOOLEAN",
          },
          IS_DRINK_ITEM: {
            name: "IS_DRINK_ITEM",
            type: "BOOLEAN",
          },
        },
      },
      "model.jaffle_shop.customers": {
        id: "model.jaffle_shop.customers",
        name: "customers",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_DEV",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "table",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "664488ec4c2dc2e6b48f35ec05d81258c5c7716af3f044435815046378f1d224",
        },
        raw_code:
          "with\n\ncustomers as (\n\n    select * from {{ ref('stg_customers') }}\n\n),\n\norders as (\n\n    select * from {{ ref('orders') }}\n\n),\n\ncustomer_orders_summary as (\n\n    select\n        orders.customer_id,\n\n        count(distinct orders.order_id) as count_lifetime_orders,\n        count(distinct orders.order_id) > 1 as is_repeat_buyer,\n        min(orders.ordered_at) as first_ordered_at,\n        max(orders.ordered_at) as last_ordered_at,\n        sum(orders.subtotal) as lifetime_spend_pretax,\n        sum(orders.tax_paid) as lifetime_tax_paid,\n        sum(orders.order_total) as lifetime_spend\n\n    from orders\n\n    group by 1\n\n),\n\njoined as (\n\n    select\n        customers.*,\n\n        customer_orders_summary.count_lifetime_orders,\n        customer_orders_summary.first_ordered_at,\n        customer_orders_summary.last_ordered_at,\n        customer_orders_summary.lifetime_spend_pretax,\n        customer_orders_summary.lifetime_tax_paid,\n        customer_orders_summary.lifetime_spend,\n\n        case\n            when customer_orders_summary.is_repeat_buyer then 'returning'\n            else 'new'\n        end as customer_type\n\n    from customers\n\n    left join customer_orders_summary\n        on customers.customer_id = customer_orders_summary.customer_id\n\n)\n\nselect * from joined",
        columns: {
          CUSTOMER_ID: {
            name: "CUSTOMER_ID",
            type: "TEXT",
          },
          CUSTOMER_NAME: {
            name: "CUSTOMER_NAME",
            type: "TEXT",
          },
          COUNT_LIFETIME_ORDERS: {
            name: "COUNT_LIFETIME_ORDERS",
            type: "NUMBER",
          },
          FIRST_ORDERED_AT: {
            name: "FIRST_ORDERED_AT",
            type: "TIMESTAMP_NTZ",
          },
          LAST_ORDERED_AT: {
            name: "LAST_ORDERED_AT",
            type: "TIMESTAMP_NTZ",
          },
          LIFETIME_SPEND_PRETAX: {
            name: "LIFETIME_SPEND_PRETAX",
            type: "NUMBER",
          },
          LIFETIME_TAX_PAID: {
            name: "LIFETIME_TAX_PAID",
            type: "NUMBER",
          },
          LIFETIME_SPEND: {
            name: "LIFETIME_SPEND",
            type: "NUMBER",
          },
          CUSTOMER_TYPE: {
            name: "CUSTOMER_TYPE",
            type: "TEXT",
          },
        },
      },
      "model.jaffle_shop.orders": {
        id: "model.jaffle_shop.orders",
        name: "orders",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_DEV",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "table",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "672fab3cb996bc7652da3f751da1f11f2674290bb3fdd3b5ed4fc35b0bbb6460",
        },
        raw_code:
          "with\n\norders as (\n\n    select * from {{ ref('stg_orders') }}\n\n),\n\norder_items as (\n\n    select * from {{ ref('order_items') }}\n\n),\n\norder_items_summary as (\n\n    select\n        order_id,\n\n        sum(supply_cost) as order_cost,\n        sum(product_price) as order_items_subtotal,\n        count(order_item_id) as count_order_items,\n        sum(\n            case\n                when is_food_item then 1\n                else 0\n            end\n        ) as count_food_items,\n        sum(\n            case\n                when is_drink_item then 1\n                else 0\n            end\n        ) as count_drink_items\n\n    from order_items\n\n    group by 1\n\n),\n\ncompute_booleans as (\n\n    select\n        orders.*,\n\n        order_items_summary.order_cost,\n        order_items_summary.order_items_subtotal,\n        order_items_summary.count_food_items,\n        order_items_summary.count_drink_items,\n        order_items_summary.count_order_items,\n        order_items_summary.count_food_items > 0 as is_food_order,\n        order_items_summary.count_drink_items > 0 as is_drink_order\n\n    from orders\n\n    left join\n        order_items_summary\n        on orders.order_id = order_items_summary.order_id\n\n),\n\ncustomer_order_count as (\n\n    select\n        *,\n\n        row_number() over (\n            partition by customer_id\n            order by ordered_at asc\n        ) as customer_order_number\n\n    from compute_booleans\n\n)\n\nselect * from customer_order_count",
        columns: {
          ORDER_ID: {
            name: "ORDER_ID",
            type: "TEXT",
          },
          LOCATION_ID: {
            name: "LOCATION_ID",
            type: "TEXT",
          },
          CUSTOMER_ID: {
            name: "CUSTOMER_ID",
            type: "TEXT",
          },
          SUBTOTAL_CENTS: {
            name: "SUBTOTAL_CENTS",
            type: "NUMBER",
          },
          TAX_PAID_CENTS: {
            name: "TAX_PAID_CENTS",
            type: "NUMBER",
          },
          ORDER_TOTAL_CENTS: {
            name: "ORDER_TOTAL_CENTS",
            type: "NUMBER",
          },
          SUBTOTAL: {
            name: "SUBTOTAL",
            type: "NUMBER",
          },
          TAX_PAID: {
            name: "TAX_PAID",
            type: "NUMBER",
          },
          ORDER_TOTAL: {
            name: "ORDER_TOTAL",
            type: "NUMBER",
          },
          ORDERED_AT: {
            name: "ORDERED_AT",
            type: "TIMESTAMP_NTZ",
          },
          ORDER_COST: {
            name: "ORDER_COST",
            type: "NUMBER",
          },
          ORDER_ITEMS_SUBTOTAL: {
            name: "ORDER_ITEMS_SUBTOTAL",
            type: "NUMBER",
          },
          COUNT_FOOD_ITEMS: {
            name: "COUNT_FOOD_ITEMS",
            type: "NUMBER",
          },
          COUNT_DRINK_ITEMS: {
            name: "COUNT_DRINK_ITEMS",
            type: "NUMBER",
          },
          COUNT_ORDER_ITEMS: {
            name: "COUNT_ORDER_ITEMS",
            type: "NUMBER",
          },
          IS_FOOD_ORDER: {
            name: "IS_FOOD_ORDER",
            type: "BOOLEAN",
          },
          IS_DRINK_ORDER: {
            name: "IS_DRINK_ORDER",
            type: "BOOLEAN",
          },
          CUSTOMER_ORDER_NUMBER: {
            name: "CUSTOMER_ORDER_NUMBER",
            type: "NUMBER",
          },
        },
      },
      "model.jaffle_shop.metricflow_time_spine": {
        id: "model.jaffle_shop.metricflow_time_spine",
        name: "metricflow_time_spine",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_DEV",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "table",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "1c1814c8aaffb1e0562f046f6e8ced94c7eeb536f67a794d4f7a55fa8a1a9109",
        },
        raw_code:
          "-- metricflow_time_spine.sql\nwith\n\ndays as (\n\n    --for BQ adapters use \"DATE('01/01/2000','mm/dd/yyyy')\"\n    {{ dbt_date.get_base_dates(n_dateparts=365*10, datepart=\"day\") }}\n\n),\n\ncast_to_date as (\n\n    select cast(date_day as date) as date_day\n\n    from days\n\n)\n\nselect * from cast_to_date",
        columns: {
          DATE_DAY: {
            name: "DATE_DAY",
            type: "DATE",
          },
        },
      },
      "model.jaffle_shop.order_items": {
        id: "model.jaffle_shop.order_items",
        name: "order_items",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_DEV",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "table",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "f6268350d0266dc7b23e662349e4c94a9e1d9f4689765055ba7c5ea07d82a06c",
        },
        raw_code:
          "with\n\norder_items as (\n\n    select * from {{ ref('stg_order_items') }}\n\n),\n\n\norders as (\n\n    select * from {{ ref('stg_orders') }}\n\n),\n\nproducts as (\n\n    select * from {{ ref('stg_products') }}\n\n),\n\nsupplies as (\n\n    select * from {{ ref('stg_supplies') }}\n\n),\n\norder_supplies_summary as (\n\n    select\n        product_id,\n\n        sum(supply_cost) as supply_cost\n\n    from supplies\n\n    group by 1\n\n),\n\njoined as (\n\n    select\n        order_items.*,\n\n        orders.ordered_at,\n\n        products.product_name,\n        products.product_price,\n        products.is_food_item,\n        products.is_drink_item,\n\n        order_supplies_summary.supply_cost\n\n    from order_items\n\n    left join orders on order_items.order_id = orders.order_id\n\n    left join products on order_items.product_id = products.product_id\n\n    left join order_supplies_summary\n        on order_items.product_id = order_supplies_summary.product_id\n\n)\n\nselect * from joined",
        columns: {
          ORDER_ITEM_ID: {
            name: "ORDER_ITEM_ID",
            type: "TEXT",
          },
          ORDER_ID: {
            name: "ORDER_ID",
            type: "TEXT",
          },
          PRODUCT_ID: {
            name: "PRODUCT_ID",
            type: "TEXT",
          },
          ORDERED_AT: {
            name: "ORDERED_AT",
            type: "TIMESTAMP_NTZ",
          },
          PRODUCT_NAME: {
            name: "PRODUCT_NAME",
            type: "TEXT",
          },
          PRODUCT_PRICE: {
            name: "PRODUCT_PRICE",
            type: "NUMBER",
          },
          IS_FOOD_ITEM: {
            name: "IS_FOOD_ITEM",
            type: "BOOLEAN",
          },
          IS_DRINK_ITEM: {
            name: "IS_DRINK_ITEM",
            type: "BOOLEAN",
          },
          SUPPLY_COST: {
            name: "SUPPLY_COST",
            type: "NUMBER",
          },
        },
      },
      "model.jaffle_shop.locations": {
        id: "model.jaffle_shop.locations",
        name: "locations",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "GITLAB_JAFFLE_SHOP_DEV",
        config: {
          enabled: true,
          alias: null,
          schema: null,
          database: null,
          tags: [],
          meta: {},
          group: null,
          materialized: "table",
          incremental_strategy: null,
          batch_size: null,
          lookback: 1,
          begin: null,
          persist_docs: {},
          "post-hook": [],
          "pre-hook": [],
          quoting: {},
          column_types: {},
          full_refresh: null,
          unique_key: null,
          on_schema_change: "ignore",
          on_configuration_change: "apply",
          grants: {},
          packages: [],
          docs: {
            show: true,
            node_color: null,
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          event_time: null,
          concurrent_batches: null,
          access: "protected",
          freshness: null,
        },
        checksum: {
          name: "sha256",
          checksum:
            "01e79fced00fb035440afc48077281f3c01163cfb6ae19ccbc4d73cc1ed7d2cf",
        },
        raw_code:
          "with\n\nlocations as (\n\n    select * from {{ ref('stg_locations') }}\n\n)\n\nselect * from locations",
        columns: {
          LOCATION_ID: {
            name: "LOCATION_ID",
            type: "TEXT",
          },
          LOCATION_NAME: {
            name: "LOCATION_NAME",
            type: "TEXT",
          },
          TAX_RATE: {
            name: "TAX_RATE",
            type: "FLOAT",
          },
          OPENED_DATE: {
            name: "OPENED_DATE",
            type: "TIMESTAMP_NTZ",
          },
        },
      },
      "source.jaffle_shop.ecom.raw_customers": {
        id: "source.jaffle_shop.ecom.raw_customers",
        name: "raw_customers",
        source_name: "ecom",
        resource_type: "source",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          event_time: null,
          freshness: {
            warn_after: {
              count: null,
              period: null,
            },
            error_after: {
              count: null,
              period: null,
            },
            filter: null,
          },
          loaded_at_field: null,
          loaded_at_query: null,
          meta: {},
          tags: [],
        },
        columns: {
          ID: {
            name: "ID",
            type: "TEXT",
          },
          NAME: {
            name: "NAME",
            type: "TEXT",
          },
        },
      },
      "source.jaffle_shop.ecom.raw_orders": {
        id: "source.jaffle_shop.ecom.raw_orders",
        name: "raw_orders",
        source_name: "ecom",
        resource_type: "source",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          event_time: null,
          freshness: {
            warn_after: {
              count: null,
              period: null,
            },
            error_after: {
              count: null,
              period: null,
            },
            filter: null,
          },
          loaded_at_field: "ordered_at",
          loaded_at_query: null,
          meta: {},
          tags: [],
        },
        columns: {
          ID: {
            name: "ID",
            type: "TEXT",
          },
          CUSTOMER: {
            name: "CUSTOMER",
            type: "TEXT",
          },
          ORDERED_AT: {
            name: "ORDERED_AT",
            type: "TIMESTAMP_NTZ",
          },
          STORE_ID: {
            name: "STORE_ID",
            type: "TEXT",
          },
          SUBTOTAL: {
            name: "SUBTOTAL",
            type: "NUMBER",
          },
          TAX_PAID: {
            name: "TAX_PAID",
            type: "NUMBER",
          },
          ORDER_TOTAL: {
            name: "ORDER_TOTAL",
            type: "NUMBER",
          },
        },
      },
      "source.jaffle_shop.ecom.raw_items": {
        id: "source.jaffle_shop.ecom.raw_items",
        name: "raw_items",
        source_name: "ecom",
        resource_type: "source",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          event_time: null,
          freshness: {
            warn_after: {
              count: null,
              period: null,
            },
            error_after: {
              count: null,
              period: null,
            },
            filter: null,
          },
          loaded_at_field: null,
          loaded_at_query: null,
          meta: {},
          tags: [],
        },
        columns: {
          ID: {
            name: "ID",
            type: "TEXT",
          },
          ORDER_ID: {
            name: "ORDER_ID",
            type: "TEXT",
          },
          SKU: {
            name: "SKU",
            type: "TEXT",
          },
        },
      },
      "source.jaffle_shop.ecom.raw_stores": {
        id: "source.jaffle_shop.ecom.raw_stores",
        name: "raw_stores",
        source_name: "ecom",
        resource_type: "source",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          event_time: null,
          freshness: {
            warn_after: {
              count: null,
              period: null,
            },
            error_after: {
              count: null,
              period: null,
            },
            filter: null,
          },
          loaded_at_field: "opened_at",
          loaded_at_query: null,
          meta: {},
          tags: [],
        },
        columns: {
          ID: {
            name: "ID",
            type: "TEXT",
          },
          NAME: {
            name: "NAME",
            type: "TEXT",
          },
          OPENED_AT: {
            name: "OPENED_AT",
            type: "TIMESTAMP_NTZ",
          },
          TAX_RATE: {
            name: "TAX_RATE",
            type: "FLOAT",
          },
        },
      },
      "source.jaffle_shop.ecom.raw_products": {
        id: "source.jaffle_shop.ecom.raw_products",
        name: "raw_products",
        source_name: "ecom",
        resource_type: "source",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          event_time: null,
          freshness: {
            warn_after: {
              count: null,
              period: null,
            },
            error_after: {
              count: null,
              period: null,
            },
            filter: null,
          },
          loaded_at_field: null,
          loaded_at_query: null,
          meta: {},
          tags: [],
        },
        columns: {
          SKU: {
            name: "SKU",
            type: "TEXT",
          },
          NAME: {
            name: "NAME",
            type: "TEXT",
          },
          TYPE: {
            name: "TYPE",
            type: "TEXT",
          },
          PRICE: {
            name: "PRICE",
            type: "NUMBER",
          },
          DESCRIPTION: {
            name: "DESCRIPTION",
            type: "TEXT",
          },
        },
      },
      "source.jaffle_shop.ecom.raw_supplies": {
        id: "source.jaffle_shop.ecom.raw_supplies",
        name: "raw_supplies",
        source_name: "ecom",
        resource_type: "source",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          event_time: null,
          freshness: {
            warn_after: {
              count: null,
              period: null,
            },
            error_after: {
              count: null,
              period: null,
            },
            filter: null,
          },
          loaded_at_field: null,
          loaded_at_query: null,
          meta: {},
          tags: [],
        },
        columns: {
          ID: {
            name: "ID",
            type: "TEXT",
          },
          NAME: {
            name: "NAME",
            type: "TEXT",
          },
          COST: {
            name: "COST",
            type: "NUMBER",
          },
          PERISHABLE: {
            name: "PERISHABLE",
            type: "BOOLEAN",
          },
          SKU: {
            name: "SKU",
            type: "TEXT",
          },
        },
      },
      "metric.jaffle_shop.lifetime_spend_pretax": {
        id: "metric.jaffle_shop.lifetime_spend_pretax",
        name: "lifetime_spend_pretax",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.count_lifetime_orders": {
        id: "metric.jaffle_shop.count_lifetime_orders",
        name: "count_lifetime_orders",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.average_order_value": {
        id: "metric.jaffle_shop.average_order_value",
        name: "average_order_value",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.order_total": {
        id: "metric.jaffle_shop.order_total",
        name: "order_total",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.new_customer_orders": {
        id: "metric.jaffle_shop.new_customer_orders",
        name: "new_customer_orders",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.large_orders": {
        id: "metric.jaffle_shop.large_orders",
        name: "large_orders",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.orders": {
        id: "metric.jaffle_shop.orders",
        name: "orders",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.food_orders": {
        id: "metric.jaffle_shop.food_orders",
        name: "food_orders",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.drink_orders": {
        id: "metric.jaffle_shop.drink_orders",
        name: "drink_orders",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.revenue": {
        id: "metric.jaffle_shop.revenue",
        name: "revenue",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.order_cost": {
        id: "metric.jaffle_shop.order_cost",
        name: "order_cost",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.median_revenue": {
        id: "metric.jaffle_shop.median_revenue",
        name: "median_revenue",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.food_revenue": {
        id: "metric.jaffle_shop.food_revenue",
        name: "food_revenue",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.drink_revenue": {
        id: "metric.jaffle_shop.drink_revenue",
        name: "drink_revenue",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.food_revenue_pct": {
        id: "metric.jaffle_shop.food_revenue_pct",
        name: "food_revenue_pct",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.drink_revenue_pct": {
        id: "metric.jaffle_shop.drink_revenue_pct",
        name: "drink_revenue_pct",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.revenue_growth_mom": {
        id: "metric.jaffle_shop.revenue_growth_mom",
        name: "revenue_growth_mom",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.order_gross_profit": {
        id: "metric.jaffle_shop.order_gross_profit",
        name: "order_gross_profit",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "metric.jaffle_shop.cumulative_revenue": {
        id: "metric.jaffle_shop.cumulative_revenue",
        name: "cumulative_revenue",
        resource_type: "metric",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "semantic_model.jaffle_shop.products": {
        id: "semantic_model.jaffle_shop.products",
        name: "products",
        resource_type: "semantic_model",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "semantic_model.jaffle_shop.customers": {
        id: "semantic_model.jaffle_shop.customers",
        name: "customers",
        resource_type: "semantic_model",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "semantic_model.jaffle_shop.orders": {
        id: "semantic_model.jaffle_shop.orders",
        name: "orders",
        resource_type: "semantic_model",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "semantic_model.jaffle_shop.supplies": {
        id: "semantic_model.jaffle_shop.supplies",
        name: "supplies",
        resource_type: "semantic_model",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "semantic_model.jaffle_shop.locations": {
        id: "semantic_model.jaffle_shop.locations",
        name: "locations",
        resource_type: "semantic_model",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
      "semantic_model.jaffle_shop.order_item": {
        id: "semantic_model.jaffle_shop.order_item",
        name: "order_item",
        resource_type: "semantic_model",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
          group: null,
          meta: {},
        },
      },
    },
    manifest_metadata: {
      dbt_schema_version: "https://schemas.getdbt.com/dbt/manifest/v12.json",
      dbt_version: "1.10.13",
      generated_at: "2026-01-16T06:48:03.156111Z",
      invocation_id: "8e7ac811-da33-4fb6-bc53-9cf4dafb8a7e",
      invocation_started_at: "2026-01-16T06:48:02.440035Z",
      env: {},
      project_name: "jaffle_shop",
      project_id: "06e5b98c2db46f8a72cc4f66410e9b3b",
      user_id: "98a1429d-26ce-4378-bc71-6d84ee1ef09d",
      send_anonymous_usage_stats: true,
      adapter_type: "snowflake",
      quoting: {
        database: false,
        schema: false,
        identifier: false,
        column: null,
      },
    },
    catalog_metadata: {
      dbt_schema_version: "https://schemas.getdbt.com/dbt/catalog/v1.json",
      dbt_version: "1.10.13",
      generated_at: "2026-01-16T06:48:27.025192Z",
      invocation_id: "8e7ac811-da33-4fb6-bc53-9cf4dafb8a7e",
      invocation_started_at: "2026-01-16T06:48:02.440035Z",
      env: {},
    },
  },
  diff: {},
};

const order_item_idCLL = {
  current: {
    nodes: {},
    columns: {
      "model.jaffle_shop.orders_COUNT_ORDER_ITEMS": {
        id: "model.jaffle_shop.orders_COUNT_ORDER_ITEMS",
        table_id: "model.jaffle_shop.orders",
        name: "COUNT_ORDER_ITEMS",
        type: "NUMBER",
        transformation_type: "derived",
        change_status: null,
        depends_on: [],
      },
      "model.jaffle_shop.stg_order_items_ORDER_ITEM_ID": {
        id: "model.jaffle_shop.stg_order_items_ORDER_ITEM_ID",
        table_id: "model.jaffle_shop.stg_order_items",
        name: "ORDER_ITEM_ID",
        type: "TEXT",
        transformation_type: "renamed",
        change_status: null,
        depends_on: [],
      },
      "source.jaffle_shop.ecom.raw_items_ID": {
        id: "source.jaffle_shop.ecom.raw_items_ID",
        table_id: "source.jaffle_shop.ecom.raw_items",
        name: "ID",
        type: "TEXT",
        transformation_type: "source",
        change_status: null,
        depends_on: [],
      },
      "model.jaffle_shop.order_items_ORDER_ITEM_ID": {
        id: "model.jaffle_shop.order_items_ORDER_ITEM_ID",
        table_id: "model.jaffle_shop.order_items",
        name: "ORDER_ITEM_ID",
        type: "TEXT",
        transformation_type: "passthrough",
        change_status: null,
        depends_on: [],
      },
    },
    parent_map: {
      "model.jaffle_shop.orders_COUNT_ORDER_ITEMS": [
        "model.jaffle_shop.order_items_ORDER_ITEM_ID",
      ],
      "model.jaffle_shop.stg_order_items_ORDER_ITEM_ID": [
        "source.jaffle_shop.ecom.raw_items_ID",
      ],
      "source.jaffle_shop.ecom.raw_items_ID": [],
      "model.jaffle_shop.order_items_ORDER_ITEM_ID": [
        "model.jaffle_shop.stg_order_items_ORDER_ITEM_ID",
      ],
    },
    child_map: {
      "model.jaffle_shop.order_items_ORDER_ITEM_ID": [
        "model.jaffle_shop.orders_COUNT_ORDER_ITEMS",
      ],
      "source.jaffle_shop.ecom.raw_items_ID": [
        "model.jaffle_shop.stg_order_items_ORDER_ITEM_ID",
      ],
      "model.jaffle_shop.stg_order_items_ORDER_ITEM_ID": [
        "model.jaffle_shop.order_items_ORDER_ITEM_ID",
      ],
    },
  },
};

const order_idCLL = {
  current: {
    nodes: {
      "metric.jaffle_shop.large_orders": {
        id: "metric.jaffle_shop.large_orders",
        name: "large_orders",
        package_name: "jaffle_shop",
        resource_type: "metric",
        raw_code: null,
        source_name: null,
        change_status: null,
        change_category: null,
        columns: {},
        impacted: null,
      },
      "metric.jaffle_shop.lifetime_spend_pretax": {
        id: "metric.jaffle_shop.lifetime_spend_pretax",
        name: "lifetime_spend_pretax",
        package_name: "jaffle_shop",
        resource_type: "metric",
        raw_code: null,
        source_name: null,
        change_status: null,
        change_category: null,
        columns: {},
        impacted: null,
      },
      "metric.jaffle_shop.order_total": {
        id: "metric.jaffle_shop.order_total",
        name: "order_total",
        package_name: "jaffle_shop",
        resource_type: "metric",
        raw_code: null,
        source_name: null,
        change_status: null,
        change_category: null,
        columns: {},
        impacted: null,
      },
      "metric.jaffle_shop.order_cost": {
        id: "metric.jaffle_shop.order_cost",
        name: "order_cost",
        package_name: "jaffle_shop",
        resource_type: "metric",
        raw_code: null,
        source_name: null,
        change_status: null,
        change_category: null,
        columns: {},
        impacted: null,
      },
      "semantic_model.jaffle_shop.orders": {
        id: "semantic_model.jaffle_shop.orders",
        name: "orders",
        package_name: "jaffle_shop",
        resource_type: "semantic_model",
        raw_code: null,
        source_name: null,
        change_status: null,
        change_category: null,
        columns: {},
        impacted: null,
      },
      "metric.jaffle_shop.orders": {
        id: "metric.jaffle_shop.orders",
        name: "orders",
        package_name: "jaffle_shop",
        resource_type: "metric",
        raw_code: null,
        source_name: null,
        change_status: null,
        change_category: null,
        columns: {},
        impacted: null,
      },
      "metric.jaffle_shop.average_order_value": {
        id: "metric.jaffle_shop.average_order_value",
        name: "average_order_value",
        package_name: "jaffle_shop",
        resource_type: "metric",
        raw_code: null,
        source_name: null,
        change_status: null,
        change_category: null,
        columns: {},
        impacted: null,
      },
      "model.jaffle_shop.orders": {
        id: "model.jaffle_shop.orders",
        name: "orders",
        package_name: "jaffle_shop",
        resource_type: "model",
        raw_code:
          "with\n\norders as (\n\n    select * from {{ ref('stg_orders') }}\n\n),\n\norder_items as (\n\n    select * from {{ ref('order_items') }}\n\n),\n\norder_items_summary as (\n\n    select\n        order_id,\n\n        sum(supply_cost) as order_cost,\n        sum(product_price) as order_items_subtotal,\n        count(order_item_id) as count_order_items,\n        sum(\n            case\n                when is_food_item then 1\n                else 0\n            end\n        ) as count_food_items,\n        sum(\n            case\n                when is_drink_item then 1\n                else 0\n            end\n        ) as count_drink_items\n\n    from order_items\n\n    group by 1\n\n),\n\ncompute_booleans as (\n\n    select\n        orders.*,\n\n        order_items_summary.order_cost,\n        order_items_summary.order_items_subtotal,\n        order_items_summary.count_food_items,\n        order_items_summary.count_drink_items,\n        order_items_summary.count_order_items,\n        order_items_summary.count_food_items > 0 as is_food_order,\n        order_items_summary.count_drink_items > 0 as is_drink_order\n\n    from orders\n\n    left join\n        order_items_summary\n        on orders.order_id = order_items_summary.order_id\n\n),\n\ncustomer_order_count as (\n\n    select\n        *,\n\n        row_number() over (\n            partition by customer_id\n            order by ordered_at asc\n        ) as customer_order_number\n\n    from compute_booleans\n\n)\n\nselect * from customer_order_count",
        source_name: null,
        change_status: null,
        change_category: null,
        columns: {},
        impacted: null,
      },
      "metric.jaffle_shop.order_gross_profit": {
        id: "metric.jaffle_shop.order_gross_profit",
        name: "order_gross_profit",
        package_name: "jaffle_shop",
        resource_type: "metric",
        raw_code: null,
        source_name: null,
        change_status: null,
        change_category: null,
        columns: {},
        impacted: null,
      },
      "metric.jaffle_shop.new_customer_orders": {
        id: "metric.jaffle_shop.new_customer_orders",
        name: "new_customer_orders",
        package_name: "jaffle_shop",
        resource_type: "metric",
        raw_code: null,
        source_name: null,
        change_status: null,
        change_category: null,
        columns: {},
        impacted: null,
      },
      "model.jaffle_shop.customers": {
        id: "model.jaffle_shop.customers",
        name: "customers",
        package_name: "jaffle_shop",
        resource_type: "model",
        raw_code:
          "with\n\ncustomers as (\n\n    select * from {{ ref('stg_customers') }}\n\n),\n\norders as (\n\n    select * from {{ ref('orders') }}\n\n),\n\ncustomer_orders_summary as (\n\n    select\n        orders.customer_id,\n\n        count(distinct orders.order_id) as count_lifetime_orders,\n        count(distinct orders.order_id) > 1 as is_repeat_buyer,\n        min(orders.ordered_at) as first_ordered_at,\n        max(orders.ordered_at) as last_ordered_at,\n        sum(orders.subtotal) as lifetime_spend_pretax,\n        sum(orders.tax_paid) as lifetime_tax_paid,\n        sum(orders.order_total) as lifetime_spend\n\n    from orders\n\n    group by 1\n\n),\n\njoined as (\n\n    select\n        customers.*,\n\n        customer_orders_summary.count_lifetime_orders,\n        customer_orders_summary.first_ordered_at,\n        customer_orders_summary.last_ordered_at,\n        customer_orders_summary.lifetime_spend_pretax,\n        customer_orders_summary.lifetime_tax_paid,\n        customer_orders_summary.lifetime_spend,\n\n        case\n            when customer_orders_summary.is_repeat_buyer then 'returning'\n            else 'new'\n        end as customer_type\n\n    from customers\n\n    left join customer_orders_summary\n        on customers.customer_id = customer_orders_summary.customer_id\n\n)\n\nselect * from joined",
        source_name: null,
        change_status: null,
        change_category: null,
        columns: {},
        impacted: null,
      },
      "metric.jaffle_shop.food_orders": {
        id: "metric.jaffle_shop.food_orders",
        name: "food_orders",
        package_name: "jaffle_shop",
        resource_type: "metric",
        raw_code: null,
        source_name: null,
        change_status: null,
        change_category: null,
        columns: {},
        impacted: null,
      },
      "metric.jaffle_shop.drink_orders": {
        id: "metric.jaffle_shop.drink_orders",
        name: "drink_orders",
        package_name: "jaffle_shop",
        resource_type: "metric",
        raw_code: null,
        source_name: null,
        change_status: null,
        change_category: null,
        columns: {},
        impacted: null,
      },
      "semantic_model.jaffle_shop.customers": {
        id: "semantic_model.jaffle_shop.customers",
        name: "customers",
        package_name: "jaffle_shop",
        resource_type: "semantic_model",
        raw_code: null,
        source_name: null,
        change_status: null,
        change_category: null,
        columns: {},
        impacted: null,
      },
      "metric.jaffle_shop.count_lifetime_orders": {
        id: "metric.jaffle_shop.count_lifetime_orders",
        name: "count_lifetime_orders",
        package_name: "jaffle_shop",
        resource_type: "metric",
        raw_code: null,
        source_name: null,
        change_status: null,
        change_category: null,
        columns: {},
        impacted: null,
      },
    },
    columns: {
      "model.jaffle_shop.stg_order_items_ORDER_ID": {
        id: "model.jaffle_shop.stg_order_items_ORDER_ID",
        table_id: "model.jaffle_shop.stg_order_items",
        name: "ORDER_ID",
        type: "TEXT",
        transformation_type: "passthrough",
        change_status: null,
        depends_on: [],
      },
      "source.jaffle_shop.ecom.raw_items_ORDER_ID": {
        id: "source.jaffle_shop.ecom.raw_items_ORDER_ID",
        table_id: "source.jaffle_shop.ecom.raw_items",
        name: "ORDER_ID",
        type: "TEXT",
        transformation_type: "source",
        change_status: null,
        depends_on: [],
      },
      "model.jaffle_shop.order_items_ORDER_ID": {
        id: "model.jaffle_shop.order_items_ORDER_ID",
        table_id: "model.jaffle_shop.order_items",
        name: "ORDER_ID",
        type: "TEXT",
        transformation_type: "passthrough",
        change_status: null,
        depends_on: [],
      },
    },
    parent_map: {
      "metric.jaffle_shop.large_orders": ["semantic_model.jaffle_shop.orders"],
      "metric.jaffle_shop.lifetime_spend_pretax": [
        "semantic_model.jaffle_shop.customers",
      ],
      "metric.jaffle_shop.order_total": ["semantic_model.jaffle_shop.orders"],
      "metric.jaffle_shop.order_cost": ["semantic_model.jaffle_shop.orders"],
      "semantic_model.jaffle_shop.orders": ["model.jaffle_shop.orders"],
      "metric.jaffle_shop.orders": ["semantic_model.jaffle_shop.orders"],
      "metric.jaffle_shop.average_order_value": [
        "metric.jaffle_shop.lifetime_spend_pretax",
        "metric.jaffle_shop.count_lifetime_orders",
      ],
      "model.jaffle_shop.orders": ["model.jaffle_shop.order_items_ORDER_ID"],
      "metric.jaffle_shop.order_gross_profit": [
        "metric.jaffle_shop.order_cost",
      ],
      "metric.jaffle_shop.new_customer_orders": [
        "semantic_model.jaffle_shop.orders",
      ],
      "model.jaffle_shop.customers": ["model.jaffle_shop.orders"],
      "metric.jaffle_shop.food_orders": ["semantic_model.jaffle_shop.orders"],
      "model.jaffle_shop.stg_order_items_ORDER_ID": [
        "source.jaffle_shop.ecom.raw_items_ORDER_ID",
      ],
      "source.jaffle_shop.ecom.raw_items_ORDER_ID": [],
      "model.jaffle_shop.order_items_ORDER_ID": [
        "model.jaffle_shop.stg_order_items_ORDER_ID",
      ],
      "metric.jaffle_shop.drink_orders": ["semantic_model.jaffle_shop.orders"],
      "semantic_model.jaffle_shop.customers": ["model.jaffle_shop.customers"],
      "metric.jaffle_shop.count_lifetime_orders": [
        "semantic_model.jaffle_shop.customers",
      ],
    },
    child_map: {
      "semantic_model.jaffle_shop.orders": [
        "metric.jaffle_shop.large_orders",
        "metric.jaffle_shop.orders",
        "metric.jaffle_shop.new_customer_orders",
        "metric.jaffle_shop.order_cost",
        "metric.jaffle_shop.drink_orders",
        "metric.jaffle_shop.order_total",
        "metric.jaffle_shop.food_orders",
      ],
      "semantic_model.jaffle_shop.customers": [
        "metric.jaffle_shop.lifetime_spend_pretax",
        "metric.jaffle_shop.count_lifetime_orders",
      ],
      "model.jaffle_shop.orders": [
        "model.jaffle_shop.customers",
        "semantic_model.jaffle_shop.orders",
      ],
      "metric.jaffle_shop.lifetime_spend_pretax": [
        "metric.jaffle_shop.average_order_value",
      ],
      "metric.jaffle_shop.count_lifetime_orders": [
        "metric.jaffle_shop.average_order_value",
      ],
      "model.jaffle_shop.order_items_ORDER_ID": ["model.jaffle_shop.orders"],
      "metric.jaffle_shop.order_cost": [
        "metric.jaffle_shop.order_gross_profit",
      ],
      "source.jaffle_shop.ecom.raw_items_ORDER_ID": [
        "model.jaffle_shop.stg_order_items_ORDER_ID",
      ],
      "model.jaffle_shop.stg_order_items_ORDER_ID": [
        "model.jaffle_shop.order_items_ORDER_ID",
      ],
      "model.jaffle_shop.customers": ["semantic_model.jaffle_shop.customers"],
    },
  },
};

// =============================================================================
// Exports for Storybook stories
// =============================================================================

// biome-ignore lint/suspicious/noExplicitAny: Reproducer data uses loose types
type AnyNode = any;

/**
 * Creates a LineageGraph from the large reproducer lineage data.
 * This uses the full jaffle_shop project with metrics and semantic models.
 */
export function createLargeReproducerLineageGraph(): LineageGraph {
  const nodes: Record<string, LineageGraphNode> = {};

  // Build nodes from current manifest (includes all models)
  for (const [id, nodeData] of Object.entries(
    largeReproducerLineage.current.nodes as Record<string, AnyNode>,
  )) {
    const diffInfo = (largeReproducerLineage.diff as Record<string, AnyNode>)[
      id
    ];
    const changeStatus = diffInfo?.change_status as
      | "modified"
      | "added"
      | "removed"
      | undefined;

    nodes[id] = {
      id,
      type: "lineageGraphNode",
      position: { x: 0, y: 0 },
      data: {
        id,
        name: nodeData.name,
        from: "both",
        changeStatus,
        resourceType: nodeData.resource_type,
        packageName: nodeData.package_name,
        data: {
          base: {
            ...((largeReproducerLineage.base.nodes as AnyNode)[id] || {}),
            unique_id: id,
          } as AnyNode,
          current: { ...nodeData, unique_id: id } as AnyNode,
        },
        parents: {},
        children: {},
      },
    };
  }

  // Build edges from parent_map
  const edges: LineageGraph["edges"] = {};
  for (const [childId, parentIds] of Object.entries(
    largeReproducerLineage.current.parent_map,
  )) {
    if (!nodes[childId]) continue;

    for (const parentId of parentIds as string[]) {
      if (!nodes[parentId]) continue;

      const edgeId = `${parentId}->${childId}`;
      edges[edgeId] = {
        id: edgeId,
        type: "lineageGraphEdge",
        source: parentId,
        target: childId,
        data: { from: "both" },
      };

      // Set up parent relationships
      if (!nodes[childId].data.parents) {
        nodes[childId].data.parents = {};
      }
      nodes[childId].data.parents[parentId] = {} as never;
    }
  }

  // Identify modified set from diff
  const modifiedSet = Object.keys(
    largeReproducerLineage.diff as Record<string, unknown>,
  );

  return {
    nodes,
    edges,
    modifiedSet,
    manifestMetadata: {
      current: {
        ...(largeReproducerLineage.current as AnyNode).manifest_metadata,
      } as AnyNode,
      base: {
        ...(largeReproducerLineage.base as AnyNode).manifest_metadata,
      } as AnyNode,
    },
    catalogMetadata: {
      current: {
        ...(largeReproducerLineage.current as AnyNode).catalog_metadata,
      } as AnyNode,
      base: {
        ...(largeReproducerLineage.base as AnyNode).catalog_metadata,
      } as AnyNode,
    },
  };
}

/**
 * CLL data for ORDER_ITEM_ID column selection
 * Shows: raw_items.ID -> stg_order_items.ORDER_ITEM_ID -> order_items.ORDER_ITEM_ID -> orders.COUNT_ORDER_ITEMS
 */
export const orderItemIdSelectedCLL = order_item_idCLL;

/**
 * CLL data for ORDER_ID column selection
 * Shows: raw_items.ORDER_ID -> stg_order_items.ORDER_ID -> order_items.ORDER_ID -> orders (with metrics)
 */
export const orderIdSelectedCLL = order_idCLL;
