import { useEffect, useState } from "react";

//firebase imports
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * Custom React hook to subscribe to a Firestore document in real-time.
 *
 * @template T - The shape of the Firestore document data.
 * @param {string} col - The Firestore collection name.
 * @param {string} id - The document ID within the collection.
 * @returns {{ document: (T & { id: string }) | null, error: string | null }}
 * An object containing the document data (with its ID) and any error encountered.
 * 
 * @example
 * import { useDocument } from "../../hooks/useDocument";

export default function Home() {
  const { document, error } = useDocument(
    "testcollection",
    "0WYVkhdxKBF8Il1fURzZ2"
  );
  return (
    <div>
      {document && <p>{document.name}</p>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
 */
export function useDocument<T = Record<string, any>>(
  col: string,
  id: string
): { document: (T & { id: string }) | null; error: string | null } {
  const [document, setDocument] = useState<(T & { id: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  // realtime document data
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, col, id),
      (snapshot) => {
        // need to make sure the doc exists & has data
        if (snapshot.exists()) {
          setDocument({ ...(snapshot.data() as T), id: snapshot.id });
          setError(null);
        } else {
          setError("No such document exists");
        }
      },
      (err) => {
        console.log(err.message);
        setError("failed to get document");
      }
    );

    // unsubscribe on unmount
    return () => unsubscribe();
  }, [col, id]);

  return { document, error };
}
