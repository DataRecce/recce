/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ColumnLineageData } from "@datarecce/ui/api";
import type { LineageGraph, LineageGraphNode } from "@datarecce/ui/contexts";

// biome-ignore lint/suspicious/noExplicitAny: Reproducer data from actual dbt manifest has complex nested structure
export const lineage: any = {
  base: {
    parent_map: {
      "model.jaffle_shop.customer_segments": ["model.jaffle_shop.customers"],
      "model.jaffle_shop.customer_order_pattern": [
        "model.jaffle_shop.customers",
      ],
      "model.jaffle_shop.customers": [
        "model.jaffle_shop.stg_customers",
        "model.jaffle_shop.stg_orders",
        "model.jaffle_shop.stg_payments",
      ],
      "model.jaffle_shop.orders": [
        "model.jaffle_shop.stg_orders",
        "model.jaffle_shop.stg_payments",
      ],
      "model.jaffle_shop.stg_payments": [
        "source.jaffle_shop.jaffle-shop-data.raw_payments",
      ],
      "model.jaffle_shop.stg_orders": [
        "source.jaffle_shop.jaffle-shop-data.raw_orders",
      ],
      "model.jaffle_shop.stg_customers": [
        "source.jaffle_shop.jaffle-shop-data.raw_customers",
      ],
      "source.jaffle_shop.jaffle-shop-data.raw_customers": [],
      "source.jaffle_shop.jaffle-shop-data.raw_orders": [],
      "source.jaffle_shop.jaffle-shop-data.raw_payments": [],
    },
    nodes: {
      "model.jaffle_shop.customer_segments": {
        id: "model.jaffle_shop.customer_segments",
        name: "customer_segments",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "prod",
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
            node_color: "gold",
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          access: "protected",
        },
        checksum: {
          name: "sha256",
          checksum:
            "087cd6709d57d09f41add0c201dab69c1c47314fab08aa020eb28bced18ebd05",
        },
        raw_code:
          "-- Customer Segmentation based on number of orders and lifetime value\nSELECT\n    customer_id,\n    number_of_orders,\n    customer_lifetime_value,\n    CASE \n        WHEN number_of_orders > 10 THEN 'Frequent Buyer'\n        WHEN number_of_orders BETWEEN 5 AND 10 THEN 'Occasional Buyer'\n        ELSE 'Rare Buyer'\n    END AS order_frequency_segment,\n    CASE \n        WHEN customer_lifetime_value > 4000 THEN 'High Value'\n        WHEN customer_lifetime_value BETWEEN 1500 AND 4000 THEN 'Medium Value'\n        ELSE 'Low Value'\n    END AS value_segment\nFROM {{ ref('customers') }}",
        columns: {
          customer_id: {
            name: "customer_id",
            type: "BIGINT",
            not_null: true,
            unique: true,
          },
          number_of_orders: {
            name: "number_of_orders",
            type: "BIGINT",
          },
          customer_lifetime_value: {
            name: "customer_lifetime_value",
            type: "BIGINT",
          },
          order_frequency_segment: {
            name: "order_frequency_segment",
            type: "VARCHAR",
          },
          value_segment: {
            name: "value_segment",
            type: "VARCHAR",
          },
        },
        primary_key: "customer_id",
      },
      "model.jaffle_shop.customer_order_pattern": {
        id: "model.jaffle_shop.customer_order_pattern",
        name: "customer_order_pattern",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "prod",
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
            node_color: "gold",
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          access: "protected",
        },
        checksum: {
          name: "sha256",
          checksum:
            "5c35486768f205de8f347e0cad50c380f7ede6215e881221fbb165024c7b8b54",
        },
        raw_code:
          "-- Analyzing Order Patterns\nSELECT\n    customer_id,\n    first_order,\n    most_recent_order,\n    number_of_orders,\n    DATEDIFF('day', first_order, most_recent_order) AS days_active,\n    DATEDIFF('day', first_order, most_recent_order) / NULLIF(number_of_orders - 1, 0) AS avg_days_between_orders\nFROM {{ ref('customers') }}",
        columns: {
          customer_id: {
            name: "customer_id",
            type: "BIGINT",
            not_null: true,
            unique: true,
          },
          first_order: {
            name: "first_order",
            type: "DATE",
          },
          most_recent_order: {
            name: "most_recent_order",
            type: "DATE",
          },
          number_of_orders: {
            name: "number_of_orders",
            type: "BIGINT",
          },
          days_active: {
            name: "days_active",
            type: "BIGINT",
          },
          avg_days_between_orders: {
            name: "avg_days_between_orders",
            type: "DOUBLE",
          },
        },
        primary_key: "customer_id",
      },
      "model.jaffle_shop.customers": {
        id: "model.jaffle_shop.customers",
        name: "customers",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "prod",
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
            node_color: "gold",
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          access: "protected",
        },
        checksum: {
          name: "sha256",
          checksum:
            "d3b742d16b8ba5a1e9b7952a58fab257dd83524960d5adff6d2466a51855e41f",
        },
        raw_code:
          "with customers as (\n\n    select * from {{ ref('stg_customers') }}\n\n),\n\norders as (\n\n    select * from {{ ref('stg_orders') }}\n\n),\n\npayments as (\n\n    select * from {{ ref('stg_payments') }}\n\n),\n\ncustomer_orders as (\n\n        select\n        customer_id,\n\n        min(order_date) as first_order,\n        max(order_date) as most_recent_order,\n        count(order_id) as number_of_orders\n    from orders\n\n    group by customer_id\n\n),\n\ncustomer_payments as (\n\n    select\n        orders.customer_id,\n        sum(amount)::bigint as total_amount\n\n    from payments\n\n    left join orders on\n         payments.order_id = orders.order_id\n\n    group by orders.customer_id\n\n),\n\nfinal as (\n\n    select\n        customers.customer_id,\n        customers.first_name,\n        customers.last_name,\n        customer_orders.first_order,\n        customer_orders.most_recent_order,\n        customer_orders.number_of_orders,\n        customer_payments.total_amount as customer_lifetime_value\n\n    from customers\n\n    left join customer_orders\n        on customers.customer_id = customer_orders.customer_id\n\n    left join customer_payments\n        on  customers.customer_id = customer_payments.customer_id\n\n)\n\nselect * from final",
        columns: {
          customer_id: {
            name: "customer_id",
            type: "BIGINT",
            not_null: true,
            unique: true,
          },
          first_name: {
            name: "first_name",
            type: "VARCHAR",
          },
          last_name: {
            name: "last_name",
            type: "VARCHAR",
          },
          first_order: {
            name: "first_order",
            type: "DATE",
          },
          most_recent_order: {
            name: "most_recent_order",
            type: "DATE",
          },
          number_of_orders: {
            name: "number_of_orders",
            type: "BIGINT",
          },
          customer_lifetime_value: {
            name: "customer_lifetime_value",
            type: "BIGINT",
          },
        },
        primary_key: "customer_id",
      },
      "model.jaffle_shop.orders": {
        id: "model.jaffle_shop.orders",
        name: "orders",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "prod",
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
            node_color: "gold",
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          access: "protected",
        },
        checksum: {
          name: "sha256",
          checksum:
            "27f8c79aad1cfd8411ab9c3d2ce8da1d787f7f05c58bbee1d247510dc426be0f",
        },
        raw_code:
          "{% set payment_methods = ['credit_card', 'coupon', 'bank_transfer', 'gift_card'] %}\n\nwith orders as (\n\n    select * from {{ ref('stg_orders') }}\n\n),\n\npayments as (\n\n    select * from {{ ref('stg_payments') }}\n\n),\n\norder_payments as (\n\n    select\n        order_id,\n\n        {% for payment_method in payment_methods -%}\n        sum(case when payment_method = '{{ payment_method }}' then amount else 0 end) as {{ payment_method }}_amount,\n        {% endfor -%}\n\n        sum(amount) as total_amount\n\n    from payments\n\n    group by order_id\n\n),\n\nfinal as (\n\n    select\n        orders.order_id,\n        orders.customer_id,\n        orders.order_date,\n        orders.status,\n\n        {% for payment_method in payment_methods -%}\n\n        order_payments.{{ payment_method }}_amount,\n\n        {% endfor -%}\n\n        order_payments.total_amount as amount\n\n    from orders\n\n\n    left join order_payments\n        on orders.order_id = order_payments.order_id\n\n)\n\nselect * from final",
        columns: {
          order_id: {
            name: "order_id",
            type: "BIGINT",
            not_null: true,
            unique: true,
          },
          customer_id: {
            name: "customer_id",
            type: "BIGINT",
            not_null: true,
          },
          order_date: {
            name: "order_date",
            type: "DATE",
          },
          status: {
            name: "status",
            type: "VARCHAR",
          },
          credit_card_amount: {
            name: "credit_card_amount",
            type: "DOUBLE",
            not_null: true,
          },
          coupon_amount: {
            name: "coupon_amount",
            type: "DOUBLE",
            not_null: true,
          },
          bank_transfer_amount: {
            name: "bank_transfer_amount",
            type: "DOUBLE",
            not_null: true,
          },
          gift_card_amount: {
            name: "gift_card_amount",
            type: "DOUBLE",
            not_null: true,
          },
          amount: {
            name: "amount",
            type: "DOUBLE",
            not_null: true,
          },
        },
        primary_key: "order_id",
      },
      "model.jaffle_shop.stg_payments": {
        id: "model.jaffle_shop.stg_payments",
        name: "stg_payments",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "prod",
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
            node_color: "silver",
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          access: "protected",
        },
        checksum: {
          name: "sha256",
          checksum:
            "d3f3dbee2304a6e607827c605a513959def50b215bca27ba3970634ab9624c98",
        },
        raw_code:
          "with source as (\n    \n    {#-\n    Normally we would select from the table here, but we are using seeds to load\n    our data in this project\n    #}\n    select * from {{ source('jaffle-shop-data', 'raw_payments') }}\n\n),\n\nrenamed as (\n\n    select\n        id as payment_id,\n        order_id,\n        payment_method,\n\n        -- `amount` is currently stored in cents, so we convert it to dollars\n        amount / 100 as amount\n\n    from source\n\n)\n\nselect * from renamed",
        columns: {
          payment_id: {
            name: "payment_id",
            type: "BIGINT",
            not_null: true,
            unique: true,
          },
          order_id: {
            name: "order_id",
            type: "BIGINT",
          },
          payment_method: {
            name: "payment_method",
            type: "VARCHAR",
          },
          amount: {
            name: "amount",
            type: "DOUBLE",
          },
        },
        primary_key: "payment_id",
      },
      "model.jaffle_shop.stg_orders": {
        id: "model.jaffle_shop.stg_orders",
        name: "stg_orders",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "prod",
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
            node_color: "silver",
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          access: "protected",
        },
        checksum: {
          name: "sha256",
          checksum:
            "193b40dff284a3b9c31908a3b88d4ed4a0acdace36eae14a64911a21b52c3f33",
        },
        raw_code:
          "with source as (\n\n    {#-\n    Normally we would select from the table here, but we are using seeds to load\n    our data in this project\n    #}\n    select * from {{ source('jaffle-shop-data', 'raw_orders') }}\n\n),\n\nrenamed as (\n\n    select\n        id as order_id,\n        user_id as customer_id,\n        order_date,\n        status\n\n    from source\n\n)\n\nselect * from renamed",
        columns: {
          order_id: {
            name: "order_id",
            type: "BIGINT",
            not_null: true,
            unique: true,
          },
          customer_id: {
            name: "customer_id",
            type: "BIGINT",
          },
          order_date: {
            name: "order_date",
            type: "DATE",
          },
          status: {
            name: "status",
            type: "VARCHAR",
          },
        },
        primary_key: "order_id",
      },
      "model.jaffle_shop.stg_customers": {
        id: "model.jaffle_shop.stg_customers",
        name: "stg_customers",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "prod",
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
            node_color: "silver",
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          access: "protected",
        },
        checksum: {
          name: "sha256",
          checksum:
            "9d05ea3a433ea87c3b3e638120213b52b44904f86a9b47c8d0e131259dd4a58a",
        },
        raw_code:
          "with source as (\n\n    {#-\n    Normally we would select from the table here, but we are using seeds to load\n    our data in this project\n    #}\n    select * from {{ source('jaffle-shop-data', 'raw_customers') }}\n\n),\n\nrenamed as (\n\n    select\n        id as customer_id,\n        first_name,\n        last_name\n\n    from source\n\n)\n\nselect * from renamed",
        columns: {
          customer_id: {
            name: "customer_id",
            type: "BIGINT",
            not_null: true,
            unique: true,
          },
          first_name: {
            name: "first_name",
            type: "VARCHAR",
          },
          last_name: {
            name: "last_name",
            type: "VARCHAR",
          },
        },
        primary_key: "customer_id",
      },
      "source.jaffle_shop.jaffle-shop-data.raw_customers": {
        id: "source.jaffle_shop.jaffle-shop-data.raw_customers",
        name: "raw_customers",
        source_name: "jaffle-shop-data",
        resource_type: "source",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
        },
      },
      "source.jaffle_shop.jaffle-shop-data.raw_orders": {
        id: "source.jaffle_shop.jaffle-shop-data.raw_orders",
        name: "raw_orders",
        source_name: "jaffle-shop-data",
        resource_type: "source",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
        },
      },
      "source.jaffle_shop.jaffle-shop-data.raw_payments": {
        id: "source.jaffle_shop.jaffle-shop-data.raw_payments",
        name: "raw_payments",
        source_name: "jaffle-shop-data",
        resource_type: "source",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
        },
      },
    },
    manifest_metadata: {
      dbt_schema_version: "https://schemas.getdbt.com/dbt/manifest/v12.json",
      dbt_version: "1.8.1",
      generated_at: "2026-02-04T14:25:31.191372Z",
      invocation_id: "263b4b48-975d-47d6-acec-8b12d36c6f46",
      env: {},
      project_name: "jaffle_shop",
      project_id: "06e5b98c2db46f8a72cc4f66410e9b3b",
      user_id: "5650a779-c0cc-4e67-bd73-8ad5088fde09",
      send_anonymous_usage_stats: true,
      adapter_type: "duckdb",
    },
    catalog_metadata: {
      dbt_schema_version: "https://schemas.getdbt.com/dbt/catalog/v1.json",
      dbt_version: "1.8.1",
      generated_at: "2026-02-04T14:25:35.289142Z",
      invocation_id: "263b4b48-975d-47d6-acec-8b12d36c6f46",
      env: {},
    },
  },
  current: {
    parent_map: {
      "model.jaffle_shop.customer_segments": ["model.jaffle_shop.customers"],
      "model.jaffle_shop.customer_order_pattern": [
        "model.jaffle_shop.customers",
      ],
      "model.jaffle_shop.customers": [
        "model.jaffle_shop.stg_customers",
        "model.jaffle_shop.stg_orders",
        "model.jaffle_shop.stg_payments",
      ],
      "model.jaffle_shop.orders": [
        "model.jaffle_shop.stg_orders",
        "model.jaffle_shop.stg_payments",
      ],
      "model.jaffle_shop.finance_revenue": [
        "model.jaffle_shop.stg_orders",
        "model.jaffle_shop.stg_payments",
      ],
      "model.jaffle_shop.stg_payments": [
        "source.jaffle_shop.jaffle-shop-data.raw_payments",
      ],
      "model.jaffle_shop.stg_orders": [
        "source.jaffle_shop.jaffle-shop-data.raw_orders",
      ],
      "model.jaffle_shop.stg_customers": [
        "source.jaffle_shop.jaffle-shop-data.raw_customers",
      ],
      "source.jaffle_shop.jaffle-shop-data.raw_customers": [],
      "source.jaffle_shop.jaffle-shop-data.raw_orders": [],
      "source.jaffle_shop.jaffle-shop-data.raw_payments": [],
    },
    nodes: {
      "model.jaffle_shop.customer_segments": {
        id: "model.jaffle_shop.customer_segments",
        name: "customer_segments",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "dev",
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
            node_color: "gold",
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          access: "protected",
        },
        checksum: {
          name: "sha256",
          checksum:
            "6db47772861e647037ba9660e876811c8f2dfe45b6df346f16152e0f457219f2",
        },
        raw_code:
          "-- Customer Segmentation based on number of orders and lifetime value\nSELECT\n    customer_id,\n    number_of_orders,\n    customer_lifetime_value,\n    net_customer_lifetime_value,\n    CASE \n        WHEN number_of_orders > 10 THEN 'Frequent Buyer'\n        WHEN number_of_orders BETWEEN 5 AND 10 THEN 'Occasional Buyer'\n        ELSE 'Rare Buyer'\n    END AS order_frequency_segment,\n    CASE \n        WHEN customer_lifetime_value > 4000 THEN 'High Value'\n        WHEN customer_lifetime_value BETWEEN 1500 AND 4000 THEN 'Medium Value'\n        ELSE 'Low Value'\n    END AS value_segment,\n    CASE \n        WHEN net_customer_lifetime_value > 4000 THEN 'High Value'\n        WHEN net_customer_lifetime_value BETWEEN 1500 AND 4000 THEN 'Medium Value'\n        ELSE 'Low Value'\n    END AS net_value_segment\nFROM {{ ref('customers') }}",
        columns: {
          customer_id: {
            name: "customer_id",
            type: "BIGINT",
            not_null: true,
            unique: true,
          },
          number_of_orders: {
            name: "number_of_orders",
            type: "BIGINT",
            not_null: true,
          },
          customer_lifetime_value: {
            name: "customer_lifetime_value",
            type: "BIGINT",
          },
          net_customer_lifetime_value: {
            name: "net_customer_lifetime_value",
            type: "BIGINT",
          },
          order_frequency_segment: {
            name: "order_frequency_segment",
            type: "VARCHAR",
            not_null: true,
          },
          value_segment: {
            name: "value_segment",
            type: "VARCHAR",
          },
          net_value_segment: {
            name: "net_value_segment",
            type: "VARCHAR",
          },
        },
        primary_key: "customer_id",
      },
      "model.jaffle_shop.customer_order_pattern": {
        id: "model.jaffle_shop.customer_order_pattern",
        name: "customer_order_pattern",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "dev",
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
            node_color: "gold",
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          access: "protected",
        },
        checksum: {
          name: "sha256",
          checksum:
            "5c35486768f205de8f347e0cad50c380f7ede6215e881221fbb165024c7b8b54",
        },
        raw_code:
          "-- Analyzing Order Patterns\nSELECT\n    customer_id,\n    first_order,\n    most_recent_order,\n    number_of_orders,\n    DATEDIFF('day', first_order, most_recent_order) AS days_active,\n    DATEDIFF('day', first_order, most_recent_order) / NULLIF(number_of_orders - 1, 0) AS avg_days_between_orders\nFROM {{ ref('customers') }}",
        columns: {
          customer_id: {
            name: "customer_id",
            type: "BIGINT",
            not_null: true,
            unique: true,
          },
          first_order: {
            name: "first_order",
            type: "DATE",
          },
          most_recent_order: {
            name: "most_recent_order",
            type: "DATE",
          },
          number_of_orders: {
            name: "number_of_orders",
            type: "BIGINT",
          },
          days_active: {
            name: "days_active",
            type: "BIGINT",
          },
          avg_days_between_orders: {
            name: "avg_days_between_orders",
            type: "DOUBLE",
          },
        },
        primary_key: "customer_id",
      },
      "model.jaffle_shop.customers": {
        id: "model.jaffle_shop.customers",
        name: "customers",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "dev",
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
            node_color: "gold",
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          access: "protected",
        },
        checksum: {
          name: "sha256",
          checksum:
            "157c13a2fd4c3e2b1cd5d3191f9e7c3f2cbed7a7c942c28859f72526e954c666",
        },
        raw_code:
          "with customers as (\n\n    select * from {{ ref('stg_customers') }}\n\n),\n\norders as (\n\n    select * from {{ ref('stg_orders') }}\n\n),\n\npayments as (\n\n    select * from {{ ref('stg_payments') }}\n\n),\n\ncustomer_orders as (\n\n        select\n        customer_id,\n\n        min(order_date) as first_order,\n        max(order_date) as most_recent_order,\n        count(order_id) as number_of_orders\n    from orders\n\n    group by customer_id\n\n),\n\ncustomer_payments as (\n\n    select\n        orders.customer_id,\n        sum(amount)::bigint as gross_amount, -- Includes coupon amount\n        sum(amount - coupon_amount)::bigint as net_amount, -- Excludes coupon amount\n\n    from payments\n\n    left join orders on\n         payments.order_id = orders.order_id\n        and orders.status = 'completed'\n\n    where payments.amount is not null -- Exclude incomplete payments\n        and payments.amount > 0 -- Exclude negative amounts\n\n    group by orders.customer_id\n\n),\n\nfinal as (\n\n    select\n        customers.customer_id,\n        customers.first_name,\n        customers.last_name,\n        customer_orders.first_order,\n        customer_orders.most_recent_order,\n        customer_orders.number_of_orders,\n        customer_payments.gross_amount as customer_lifetime_value, -- Gross CLV\n        customer_payments.net_amount as net_customer_lifetime_value -- Net CLV\n\n    from customers\n\n    left join customer_orders\n        on customers.customer_id = customer_orders.customer_id\n\n    left join customer_payments\n        on  customers.customer_id = customer_payments.customer_id\n\n)\n\nselect * from final",
        columns: {
          customer_id: {
            name: "customer_id",
            type: "BIGINT",
            not_null: true,
            unique: true,
          },
          first_name: {
            name: "first_name",
            type: "VARCHAR",
          },
          last_name: {
            name: "last_name",
            type: "VARCHAR",
          },
          first_order: {
            name: "first_order",
            type: "DATE",
          },
          most_recent_order: {
            name: "most_recent_order",
            type: "DATE",
          },
          number_of_orders: {
            name: "number_of_orders",
            type: "BIGINT",
          },
          customer_lifetime_value: {
            name: "customer_lifetime_value",
            type: "BIGINT",
          },
          net_customer_lifetime_value: {
            name: "net_customer_lifetime_value",
            type: "BIGINT",
          },
        },
        primary_key: "customer_id",
      },
      "model.jaffle_shop.orders": {
        id: "model.jaffle_shop.orders",
        name: "orders",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "dev",
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
            node_color: "gold",
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          access: "protected",
        },
        checksum: {
          name: "sha256",
          checksum:
            "27f8c79aad1cfd8411ab9c3d2ce8da1d787f7f05c58bbee1d247510dc426be0f",
        },
        raw_code:
          "{% set payment_methods = ['credit_card', 'coupon', 'bank_transfer', 'gift_card'] %}\n\nwith orders as (\n\n    select * from {{ ref('stg_orders') }}\n\n),\n\npayments as (\n\n    select * from {{ ref('stg_payments') }}\n\n),\n\norder_payments as (\n\n    select\n        order_id,\n\n        {% for payment_method in payment_methods -%}\n        sum(case when payment_method = '{{ payment_method }}' then amount else 0 end) as {{ payment_method }}_amount,\n        {% endfor -%}\n\n        sum(amount) as total_amount\n\n    from payments\n\n    group by order_id\n\n),\n\nfinal as (\n\n    select\n        orders.order_id,\n        orders.customer_id,\n        orders.order_date,\n        orders.status,\n\n        {% for payment_method in payment_methods -%}\n\n        order_payments.{{ payment_method }}_amount,\n\n        {% endfor -%}\n\n        order_payments.total_amount as amount\n\n    from orders\n\n\n    left join order_payments\n        on orders.order_id = order_payments.order_id\n\n)\n\nselect * from final",
        columns: {
          order_id: {
            name: "order_id",
            type: "BIGINT",
            not_null: true,
            unique: true,
          },
          customer_id: {
            name: "customer_id",
            type: "BIGINT",
            not_null: true,
          },
          order_date: {
            name: "order_date",
            type: "DATE",
          },
          status: {
            name: "status",
            type: "VARCHAR",
          },
          credit_card_amount: {
            name: "credit_card_amount",
            type: "DOUBLE",
            not_null: true,
          },
          coupon_amount: {
            name: "coupon_amount",
            type: "DOUBLE",
            not_null: true,
          },
          bank_transfer_amount: {
            name: "bank_transfer_amount",
            type: "DOUBLE",
            not_null: true,
          },
          gift_card_amount: {
            name: "gift_card_amount",
            type: "DOUBLE",
            not_null: true,
          },
          amount: {
            name: "amount",
            type: "DOUBLE",
            not_null: true,
          },
        },
        primary_key: "order_id",
      },
      "model.jaffle_shop.finance_revenue": {
        id: "model.jaffle_shop.finance_revenue",
        name: "finance_revenue",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "dev",
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
            node_color: "gold",
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          access: "protected",
        },
        checksum: {
          name: "sha256",
          checksum:
            "e306af53251704bf1c3b91fcb1db810ee315a389f2d8d132ec35b83adfcd8c34",
        },
        raw_code:
          "with payments as (\n    select * from {{ ref('stg_payments') }}\n),\n\npayments_revenue as (\n    select\n        order_id,\n        sum(amount) as gross_revenue,\n        sum(amount - coupon_amount) as net_revenue\n    from payments\n    group by order_id\n),\n\norders as (\n    select * from {{ ref('stg_orders') }}\n),\n\nfinal as (  \n    select\n        orders.order_id,\n        orders.customer_id,\n        orders.order_date,\n        orders.status,\n        payments_revenue.gross_revenue,\n        payments_revenue.net_revenue\n    from orders\n    left join payments_revenue\n        on orders.order_id = payments_revenue.order_id\n)\n\nselect * from final",
        columns: {
          order_id: {
            name: "order_id",
            type: "BIGINT",
            not_null: true,
            unique: true,
          },
          customer_id: {
            name: "customer_id",
            type: "BIGINT",
            not_null: true,
          },
          order_date: {
            name: "order_date",
            type: "DATE",
            not_null: true,
          },
          status: {
            name: "status",
            type: "VARCHAR",
            not_null: true,
          },
          gross_revenue: {
            name: "gross_revenue",
            type: "DOUBLE",
            not_null: true,
          },
          net_revenue: {
            name: "net_revenue",
            type: "DOUBLE",
            not_null: true,
          },
        },
        primary_key: "order_id",
      },
      "model.jaffle_shop.stg_payments": {
        id: "model.jaffle_shop.stg_payments",
        name: "stg_payments",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "dev",
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
            node_color: "silver",
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          access: "protected",
        },
        checksum: {
          name: "sha256",
          checksum:
            "ec8f49abd395b3187fa8411a707de3fc86cc82e9aa02c0e442f278b87d5318cd",
        },
        raw_code:
          "with source as (\n    \n    {#-\n    Normally we would select from the table here, but we are using seeds to load\n    our data in this project\n    #}\n    select * from {{ source('jaffle-shop-data', 'raw_payments') }}\n\n),\n\nrenamed as (\n\n    select\n        id as payment_id,\n        order_id,\n        payment_method,\n\n        -- `amount` is currently stored in cents, so we convert it to dollars\n        amount / 100 as amount,\n        (payment_method = 'coupon')::int * (amount / 100) as coupon_amount\n\n    from source\n\n)\n\nselect * from renamed",
        columns: {
          payment_id: {
            name: "payment_id",
            type: "BIGINT",
            not_null: true,
            unique: true,
          },
          order_id: {
            name: "order_id",
            type: "BIGINT",
          },
          payment_method: {
            name: "payment_method",
            type: "VARCHAR",
          },
          amount: {
            name: "amount",
            type: "DOUBLE",
            not_null: true,
          },
          coupon_amount: {
            name: "coupon_amount",
            type: "DOUBLE",
            not_null: true,
          },
        },
        primary_key: "payment_id",
      },
      "model.jaffle_shop.stg_orders": {
        id: "model.jaffle_shop.stg_orders",
        name: "stg_orders",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "dev",
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
            node_color: "silver",
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          access: "protected",
        },
        checksum: {
          name: "sha256",
          checksum:
            "193b40dff284a3b9c31908a3b88d4ed4a0acdace36eae14a64911a21b52c3f33",
        },
        raw_code:
          "with source as (\n\n    {#-\n    Normally we would select from the table here, but we are using seeds to load\n    our data in this project\n    #}\n    select * from {{ source('jaffle-shop-data', 'raw_orders') }}\n\n),\n\nrenamed as (\n\n    select\n        id as order_id,\n        user_id as customer_id,\n        order_date,\n        status\n\n    from source\n\n)\n\nselect * from renamed",
        columns: {
          order_id: {
            name: "order_id",
            type: "BIGINT",
            not_null: true,
            unique: true,
          },
          customer_id: {
            name: "customer_id",
            type: "BIGINT",
          },
          order_date: {
            name: "order_date",
            type: "DATE",
          },
          status: {
            name: "status",
            type: "VARCHAR",
          },
        },
        primary_key: "order_id",
      },
      "model.jaffle_shop.stg_customers": {
        id: "model.jaffle_shop.stg_customers",
        name: "stg_customers",
        resource_type: "model",
        package_name: "jaffle_shop",
        schema: "dev",
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
            node_color: "silver",
          },
          contract: {
            enforced: false,
            alias_types: true,
          },
          access: "protected",
        },
        checksum: {
          name: "sha256",
          checksum:
            "9d05ea3a433ea87c3b3e638120213b52b44904f86a9b47c8d0e131259dd4a58a",
        },
        raw_code:
          "with source as (\n\n    {#-\n    Normally we would select from the table here, but we are using seeds to load\n    our data in this project\n    #}\n    select * from {{ source('jaffle-shop-data', 'raw_customers') }}\n\n),\n\nrenamed as (\n\n    select\n        id as customer_id,\n        first_name,\n        last_name\n\n    from source\n\n)\n\nselect * from renamed",
        columns: {
          customer_id: {
            name: "customer_id",
            type: "BIGINT",
            not_null: true,
            unique: true,
          },
          first_name: {
            name: "first_name",
            type: "VARCHAR",
          },
          last_name: {
            name: "last_name",
            type: "VARCHAR",
          },
        },
        primary_key: "customer_id",
      },
      "source.jaffle_shop.jaffle-shop-data.raw_customers": {
        id: "source.jaffle_shop.jaffle-shop-data.raw_customers",
        name: "raw_customers",
        source_name: "jaffle-shop-data",
        resource_type: "source",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
        },
      },
      "source.jaffle_shop.jaffle-shop-data.raw_orders": {
        id: "source.jaffle_shop.jaffle-shop-data.raw_orders",
        name: "raw_orders",
        source_name: "jaffle-shop-data",
        resource_type: "source",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
        },
      },
      "source.jaffle_shop.jaffle-shop-data.raw_payments": {
        id: "source.jaffle_shop.jaffle-shop-data.raw_payments",
        name: "raw_payments",
        source_name: "jaffle-shop-data",
        resource_type: "source",
        package_name: "jaffle_shop",
        config: {
          enabled: true,
        },
      },
    },
    manifest_metadata: {
      dbt_schema_version: "https://schemas.getdbt.com/dbt/manifest/v12.json",
      dbt_version: "1.8.1",
      generated_at: "2026-02-04T14:26:35.687349Z",
      invocation_id: "2651aeb4-dbe1-4f64-984f-9b1af62e6799",
      env: {},
      project_name: "jaffle_shop",
      project_id: "06e5b98c2db46f8a72cc4f66410e9b3b",
      user_id: "5650a779-c0cc-4e67-bd73-8ad5088fde09",
      send_anonymous_usage_stats: true,
      adapter_type: "duckdb",
    },
    catalog_metadata: {
      dbt_schema_version: "https://schemas.getdbt.com/dbt/catalog/v1.json",
      dbt_version: "1.8.1",
      generated_at: "2026-02-04T14:26:40.779942Z",
      invocation_id: "2651aeb4-dbe1-4f64-984f-9b1af62e6799",
      env: {},
    },
  },
  diff: {
    "model.jaffle_shop.stg_payments": {
      change_status: "modified",
      change: null,
    },
    "model.jaffle_shop.finance_revenue": {
      change_status: "added",
      change: null,
    },
    "model.jaffle_shop.customer_segments": {
      change_status: "modified",
      change: null,
    },
    "model.jaffle_shop.customers": {
      change_status: "modified",
      change: null,
    },
  },
};

// biome-ignore lint/suspicious/noExplicitAny: Reproducer data uses loose types
type AnyNode = any;

/**
 * Create a LineageGraph from the reproducer data
 */
export function createReflowLineageGraph(): LineageGraph {
  const nodes: Record<string, LineageGraphNode> = {};

  // Build nodes from current manifest (includes all models)
  for (const [id, nodeData] of Object.entries(
    lineage.current.nodes as Record<string, AnyNode>,
  )) {
    const diffInfo = lineage.diff[id];
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
          base: { ...lineage.base.nodes[id], unique_id: id } as AnyNode,
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
    lineage.current.parent_map,
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
  const modifiedSet = Object.keys(lineage.diff);

  return {
    nodes,
    edges,
    modifiedSet,
    manifestMetadata: {
      current: { ...lineage.current.manifest_metadata } as AnyNode,
      base: { ...lineage.base.manifest_metadata } as AnyNode,
    },
    catalogMetadata: {
      current: { ...lineage.current.catalog_metadata } as AnyNode,
      base: { ...lineage.base.catalog_metadata } as AnyNode,
    },
  };
}

/**
 * Create CLL data for a specific column on a node
 * This simulates the API response for column-level lineage
 * @deprecated Use the actual API response data (order_dateSelectedCLL, customer_idSelectedCLL) instead
 */
// biome-ignore lint/correctness/noUnusedVariables: kept for potential future use
function createReflowCllData(
  nodeId: string,
  columnName: string,
): ColumnLineageData {
  const nodes: ColumnLineageData["current"]["nodes"] = {};
  const columns: ColumnLineageData["current"]["columns"] = {};
  const parent_map: ColumnLineageData["current"]["parent_map"] = {};
  const child_map: ColumnLineageData["current"]["child_map"] = {};

  // Helper to get column lineage based on actual model relationships
  // This is a simplified version - in production this comes from the API
  const getImpactedNodes = (nodeId: string, column: string): string[] => {
    const impacted: string[] = [nodeId];
    const nodeData = lineage.current.nodes[
      nodeId as keyof typeof lineage.current.nodes
    ] as { columns?: Record<string, unknown> };

    if (!nodeData?.columns?.[column]) {
      return impacted;
    }

    // Get downstream nodes
    for (const [childId, parentIds] of Object.entries(
      lineage.current.parent_map,
    )) {
      if ((parentIds as string[]).includes(nodeId)) {
        impacted.push(childId);
        // Recursively add downstream
        for (const [grandchildId, grandParentIds] of Object.entries(
          lineage.current.parent_map,
        )) {
          if ((grandParentIds as string[]).includes(childId)) {
            impacted.push(grandchildId);
          }
        }
      }
    }

    // Get upstream nodes
    const parentIds =
      lineage.current.parent_map[
        nodeId as keyof typeof lineage.current.parent_map
      ] || [];
    for (const parentId of parentIds as string[]) {
      impacted.push(parentId);
      // Add upstream parents
      const grandParentIds =
        lineage.current.parent_map[
          parentId as keyof typeof lineage.current.parent_map
        ] || [];
      impacted.push(...(grandParentIds as string[]));
    }

    return [...new Set(impacted)];
  };

  const impactedNodes = getImpactedNodes(nodeId, columnName);

  // Build nodes
  for (const id of impactedNodes) {
    const nodeData = lineage.current.nodes[id] as AnyNode;
    if (!nodeData) continue;

    const diffInfo = lineage.diff[id];

    nodes[id] = {
      id,
      name: nodeData.name,
      source_name: nodeData.source_name || nodeData.package_name || "demo",
      resource_type: nodeData.resource_type,
      change_status: diffInfo?.change_status as
        | "modified"
        | "added"
        | "removed"
        | undefined,
      impacted: true,
    };

    // Add columns for this node
    const nodeColumns = (
      lineage.current.nodes[id as keyof typeof lineage.current.nodes] as {
        columns?: Record<string, { name: string; type: string }>;
      }
    )?.columns;
    if (nodeColumns) {
      for (const [colName, colData] of Object.entries(nodeColumns)) {
        const colId = `${id}_${colName}`;
        columns[colId] = {
          name: colData.name,
          type: colData.type,
          transformation_type: "passthrough",
        };
      }
    }

    // Build parent_map for node
    const parentIds =
      lineage.current.parent_map[
        id as keyof typeof lineage.current.parent_map
      ] || [];
    const filteredParents = (parentIds as string[]).filter(
      (pid: string) => impactedNodes.includes(pid) && nodes[pid],
    );
    if (filteredParents.length > 0) {
      parent_map[id] = filteredParents;
    }
  }

  return {
    current: {
      nodes,
      columns,
      parent_map,
      child_map,
    },
  };
}

/**
 * Get available columns for a node from the reproducer data
 * @deprecated Use AVAILABLE_COLUMNS constant in the story instead
 */
// biome-ignore lint/correctness/noUnusedVariables: kept for potential future use
function getNodeColumns(nodeId: string): string[] {
  const nodeData = lineage.current.nodes[
    nodeId as keyof typeof lineage.current.nodes
  ] as { columns?: Record<string, unknown> };
  if (!nodeData?.columns) return [];
  return Object.keys(nodeData.columns);
}

export const order_dateSelectedCLL = {
  nodes: {},
  columns: {
    "model.jaffle_shop.stg_orders_order_date": {
      id: "model.jaffle_shop.stg_orders_order_date",
      table_id: "model.jaffle_shop.stg_orders",
      name: "order_date",
      type: "DATE",
      transformation_type: "unknown",
      change_status: null,
      depends_on: [],
    },
    "model.jaffle_shop.customer_order_pattern_first_order": {
      id: "model.jaffle_shop.customer_order_pattern_first_order",
      table_id: "model.jaffle_shop.customer_order_pattern",
      name: "first_order",
      type: "DATE",
      transformation_type: "passthrough",
      change_status: null,
      depends_on: [],
    },
    "model.jaffle_shop.customer_order_pattern_most_recent_order": {
      id: "model.jaffle_shop.customer_order_pattern_most_recent_order",
      table_id: "model.jaffle_shop.customer_order_pattern",
      name: "most_recent_order",
      type: "DATE",
      transformation_type: "passthrough",
      change_status: null,
      depends_on: [],
    },
    "model.jaffle_shop.customer_order_pattern_days_active": {
      id: "model.jaffle_shop.customer_order_pattern_days_active",
      table_id: "model.jaffle_shop.customer_order_pattern",
      name: "days_active",
      type: "BIGINT",
      transformation_type: "derived",
      change_status: null,
      depends_on: [],
    },
    "model.jaffle_shop.customer_order_pattern_avg_days_between_orders": {
      id: "model.jaffle_shop.customer_order_pattern_avg_days_between_orders",
      table_id: "model.jaffle_shop.customer_order_pattern",
      name: "avg_days_between_orders",
      type: "DOUBLE",
      transformation_type: "derived",
      change_status: null,
      depends_on: [],
    },
    "model.jaffle_shop.finance_revenue_order_date": {
      id: "model.jaffle_shop.finance_revenue_order_date",
      table_id: "model.jaffle_shop.finance_revenue",
      name: "order_date",
      type: "DATE",
      transformation_type: "passthrough",
      change_status: null,
      depends_on: [],
    },
    "model.jaffle_shop.orders_order_date": {
      id: "model.jaffle_shop.orders_order_date",
      table_id: "model.jaffle_shop.orders",
      name: "order_date",
      type: "DATE",
      transformation_type: "passthrough",
      change_status: null,
      depends_on: [],
    },
    "model.jaffle_shop.customers_first_order": {
      id: "model.jaffle_shop.customers_first_order",
      table_id: "model.jaffle_shop.customers",
      name: "first_order",
      type: "DATE",
      transformation_type: "derived",
      change_status: null,
      depends_on: [],
    },
    "model.jaffle_shop.customers_most_recent_order": {
      id: "model.jaffle_shop.customers_most_recent_order",
      table_id: "model.jaffle_shop.customers",
      name: "most_recent_order",
      type: "DATE",
      transformation_type: "derived",
      change_status: null,
      depends_on: [],
    },
  },
  parent_map: {
    "model.jaffle_shop.stg_orders_order_date": [],
    "model.jaffle_shop.customer_order_pattern_first_order": [
      "model.jaffle_shop.customers_first_order",
    ],
    "model.jaffle_shop.customer_order_pattern_most_recent_order": [
      "model.jaffle_shop.customers_most_recent_order",
    ],
    "model.jaffle_shop.customer_order_pattern_days_active": [
      "model.jaffle_shop.customers_first_order",
      "model.jaffle_shop.customers_most_recent_order",
    ],
    "model.jaffle_shop.customer_order_pattern_avg_days_between_orders": [
      "model.jaffle_shop.customers_first_order",
      "model.jaffle_shop.customers_most_recent_order",
    ],
    "model.jaffle_shop.finance_revenue_order_date": [
      "model.jaffle_shop.stg_orders_order_date",
    ],
    "model.jaffle_shop.orders_order_date": [
      "model.jaffle_shop.stg_orders_order_date",
    ],
    "model.jaffle_shop.customers_first_order": [
      "model.jaffle_shop.stg_orders_order_date",
    ],
    "model.jaffle_shop.customers_most_recent_order": [
      "model.jaffle_shop.stg_orders_order_date",
    ],
  },
  child_map: {
    "model.jaffle_shop.customers_first_order": [
      "model.jaffle_shop.customer_order_pattern_first_order",
      "model.jaffle_shop.customer_order_pattern_avg_days_between_orders",
      "model.jaffle_shop.customer_order_pattern_days_active",
    ],
    "model.jaffle_shop.customers_most_recent_order": [
      "model.jaffle_shop.customer_order_pattern_avg_days_between_orders",
      "model.jaffle_shop.customer_order_pattern_most_recent_order",
      "model.jaffle_shop.customer_order_pattern_days_active",
    ],
    "model.jaffle_shop.stg_orders_order_date": [
      "model.jaffle_shop.customers_first_order",
      "model.jaffle_shop.orders_order_date",
      "model.jaffle_shop.customers_most_recent_order",
      "model.jaffle_shop.finance_revenue_order_date",
    ],
  },
};

export const customer_idSelectedCLL = {
  nodes: {
    "model.jaffle_shop.customer_order_pattern": {
      id: "model.jaffle_shop.customer_order_pattern",
      name: "customer_order_pattern",
      package_name: "jaffle_shop",
      resource_type: "model",
      raw_code:
        "-- Analyzing Order Patterns\nSELECT\n    customer_id,\n    first_order,\n    most_recent_order,\n    number_of_orders,\n    DATEDIFF('day', first_order, most_recent_order) AS days_active,\n    DATEDIFF('day', first_order, most_recent_order) / NULLIF(number_of_orders - 1, 0) AS avg_days_between_orders\nFROM {{ ref('customers') }}",
      source_name: null,
      change_status: null,
      change_category: null,
      columns: {},
      impacted: null,
    },
    "model.jaffle_shop.customer_segments": {
      id: "model.jaffle_shop.customer_segments",
      name: "customer_segments",
      package_name: "jaffle_shop",
      resource_type: "model",
      raw_code:
        "-- Customer Segmentation based on number of orders and lifetime value\nSELECT\n    customer_id,\n    number_of_orders,\n    customer_lifetime_value,\n    net_customer_lifetime_value,\n    CASE \n        WHEN number_of_orders > 10 THEN 'Frequent Buyer'\n        WHEN number_of_orders BETWEEN 5 AND 10 THEN 'Occasional Buyer'\n        ELSE 'Rare Buyer'\n    END AS order_frequency_segment,\n    CASE \n        WHEN customer_lifetime_value > 4000 THEN 'High Value'\n        WHEN customer_lifetime_value BETWEEN 1500 AND 4000 THEN 'Medium Value'\n        ELSE 'Low Value'\n    END AS value_segment,\n    CASE \n        WHEN net_customer_lifetime_value > 4000 THEN 'High Value'\n        WHEN net_customer_lifetime_value BETWEEN 1500 AND 4000 THEN 'Medium Value'\n        ELSE 'Low Value'\n    END AS net_value_segment\nFROM {{ ref('customers') }}",
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
        "with customers as (\n\n    select * from {{ ref('stg_customers') }}\n\n),\n\norders as (\n\n    select * from {{ ref('stg_orders') }}\n\n),\n\npayments as (\n\n    select * from {{ ref('stg_payments') }}\n\n),\n\ncustomer_orders as (\n\n        select\n        customer_id,\n\n        min(order_date) as first_order,\n        max(order_date) as most_recent_order,\n        count(order_id) as number_of_orders\n    from orders\n\n    group by customer_id\n\n),\n\ncustomer_payments as (\n\n    select\n        orders.customer_id,\n        sum(amount)::bigint as gross_amount, -- Includes coupon amount\n        sum(amount - coupon_amount)::bigint as net_amount, -- Excludes coupon amount\n\n    from payments\n\n    left join orders on\n         payments.order_id = orders.order_id\n        and orders.status = 'completed'\n\n    where payments.amount is not null -- Exclude incomplete payments\n        and payments.amount > 0 -- Exclude negative amounts\n\n    group by orders.customer_id\n\n),\n\nfinal as (\n\n    select\n        customers.customer_id,\n        customers.first_name,\n        customers.last_name,\n        customer_orders.first_order,\n        customer_orders.most_recent_order,\n        customer_orders.number_of_orders,\n        customer_payments.gross_amount as customer_lifetime_value, -- Gross CLV\n        customer_payments.net_amount as net_customer_lifetime_value -- Net CLV\n\n    from customers\n\n    left join customer_orders\n        on customers.customer_id = customer_orders.customer_id\n\n    left join customer_payments\n        on  customers.customer_id = customer_payments.customer_id\n\n)\n\nselect * from final",
      source_name: null,
      change_status: null,
      change_category: null,
      columns: {},
      impacted: null,
    },
  },
  columns: {
    "model.jaffle_shop.stg_orders_customer_id": {
      id: "model.jaffle_shop.stg_orders_customer_id",
      table_id: "model.jaffle_shop.stg_orders",
      name: "customer_id",
      type: "BIGINT",
      transformation_type: "unknown",
      change_status: null,
      depends_on: [],
    },
    "model.jaffle_shop.finance_revenue_customer_id": {
      id: "model.jaffle_shop.finance_revenue_customer_id",
      table_id: "model.jaffle_shop.finance_revenue",
      name: "customer_id",
      type: "BIGINT",
      transformation_type: "passthrough",
      change_status: null,
      depends_on: [],
    },
    "model.jaffle_shop.orders_customer_id": {
      id: "model.jaffle_shop.orders_customer_id",
      table_id: "model.jaffle_shop.orders",
      name: "customer_id",
      type: "BIGINT",
      transformation_type: "passthrough",
      change_status: null,
      depends_on: [],
    },
  },
  parent_map: {
    "model.jaffle_shop.stg_orders_customer_id": [],
    "model.jaffle_shop.customer_order_pattern": ["model.jaffle_shop.customers"],
    "model.jaffle_shop.finance_revenue_customer_id": [
      "model.jaffle_shop.stg_orders_customer_id",
    ],
    "model.jaffle_shop.customer_segments": ["model.jaffle_shop.customers"],
    "model.jaffle_shop.orders_customer_id": [
      "model.jaffle_shop.stg_orders_customer_id",
    ],
    "model.jaffle_shop.customers": ["model.jaffle_shop.stg_orders_customer_id"],
  },
  child_map: {
    "model.jaffle_shop.customers": [
      "model.jaffle_shop.customer_segments",
      "model.jaffle_shop.customer_order_pattern",
    ],
    "model.jaffle_shop.stg_orders_customer_id": [
      "model.jaffle_shop.finance_revenue_customer_id",
      "model.jaffle_shop.customers",
      "model.jaffle_shop.orders_customer_id",
    ],
  },
};
