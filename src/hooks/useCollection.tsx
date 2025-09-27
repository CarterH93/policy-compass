import { useState, useEffect, useRef } from "react";

//firebase imports
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";


type QueryTuple = [string, any, any];
type OrderByTuple = [string, "asc" | "desc"];
type FirestoreDocument = { id: string; [key: string]: any };

interface UseCollectionResult {
  documents: FirestoreDocument[] | null;
  error: string | null;
}
/**
 * Custom React hook to subscribe to a Firestore collection with optional query and orderBy parameters.
 * Returns real-time updates of documents and error state.
 *
 * @param {string} col - The name of the Firestore collection to subscribe to.
 * @param {Array} [_query] - Optional query parameters for filtering documents (e.g., ['field', '==', 'value']).
 * @param {Array} [_orderBy] - Optional orderBy parameters for sorting documents (e.g., ['field', 'asc']).
 * @returns {{ documents: Array|null, error: string|null }} An object containing the array of documents and any error message.
 * 
 * @example
 * import { useCollection } from "../../hooks/useCollection";

export default function Home() {
  const { documents, error } = useCollection("testcollection");
  return (
    <div>
      {documents &&
        documents.map((doc) => (
          <div key={doc.id}>
            <h2>{doc.name}</h2>
          </div>
        ))}
      {error && <div className="error">{error}</div>}
      {documents && documents.length === 0 && <div>No documents found</div>}
    </div>
  );
}

 */
export const useCollection = (
  col: string,
  _query?: QueryTuple,
  _orderBy?: OrderByTuple
): UseCollectionResult => {
  const [documents, setDocuments] = useState<FirestoreDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // if we don't use a ref --> infinite loop in useEffect
  // _query is an array and is "different" on every function call
  const q = useRef(_query).current;
  const oB = useRef(_orderBy).current;

  useEffect(() => {
    let ref;
    const baseRef = collection(db, col);
    if (q && oB) {
      ref = query(baseRef, where(...q), orderBy(...oB));
    } else if (q) {
      ref = query(baseRef, where(...q));
    } else if (oB) {
      ref = query(baseRef, orderBy(...oB));
    } else {
      ref = baseRef;
    }

    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const results: FirestoreDocument[] = [];
        snapshot.docs.forEach((doc) => {
          results.push({ ...doc.data(), id: doc.id });
        });
        setDocuments(results);
        setError(null);
      },
      (error) => {
        console.log(error);
        setError("Could not fetch the data");
      }
    );

    return () => unsubscribe();
  }, [col, q, oB]);

  return { documents, error };
};
