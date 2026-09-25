BEGIN;

CREATE TABLE IF NOT EXISTS item_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES table_visits(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT item_feedback_unique_visit_order_item UNIQUE (visit_id, order_item_id),
  CONSTRAINT item_feedback_rating_check CHECK (rating BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_item_feedback_menu_item_id
  ON item_feedback(menu_item_id);

COMMIT;
