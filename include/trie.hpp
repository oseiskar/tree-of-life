#include <iostream>
#include <string>
#include <map>
#include <list>
#include <stdexcept>
#include <fstream>

#include <json.hpp>
#include <utf8.hpp>

using std::string;

class UnicodeTrie {
public:
    std::map<Utf8CodePoint, UnicodeTrie> children;
    
    bool has_value;
    string value;

    typedef std::map<Utf8CodePoint, UnicodeTrie>::const_iterator const_iterator;

    void insert(const char *encoded_key, string value, bool replace = false) {
        Utf8String key = decode_utf8(encoded_key);
        Utf8String::const_iterator itr = key.begin();
        UnicodeTrie &where = lookup_subtree(itr, key.end());
        where.insert_subtree(itr, key.end(), value, replace);
    }
    
    const string *lookup(const char *encoded_key) {
        Utf8String key = decode_utf8(encoded_key);
        Utf8String::const_iterator itr = key.begin();
        UnicodeTrie &where = lookup_subtree(itr, key.end());
        if (itr != key.end() || !where.has_value) return NULL;
        return &(where.value);
    }
    
    const string &get(const char *key) {
        const string *s = lookup(key);
        if (s == NULL) throw std::runtime_error("not found");
        return *s;
    }
    
    UnicodeTrie() : has_value(false) {}
    
private:
    typedef std::map<Utf8CodePoint, UnicodeTrie>::iterator iterator;

    UnicodeTrie &lookup_subtree(
        Utf8String::const_iterator &key, 
        Utf8String::const_iterator key_end) {
        
        if (key == key_end) return *this;
        
        iterator itr = children.find(*key);
        if (itr != children.end()) {
            key++;
            return itr->second.lookup_subtree(key, key_end);
        }
        return *this;
    }
    
    void insert_subtree(
        Utf8String::const_iterator key,
        Utf8String::const_iterator key_end,
        const string &new_v, bool replace) {
        
        if (key == key_end) {
            if (!replace && has_value)
                throw std::runtime_error("key already exists in trie");
            value = new_v;
            has_value = true;
            return;
        }
        
        children[*key] = UnicodeTrie();
        children.find(*key)->second.insert_subtree(key+1, key_end, new_v, replace);
    }
};

class StringTrie {
public:
    typedef std::pair<string, StringTrie> KeyValuePair;
    std::list<KeyValuePair> children;
    typedef std::list<KeyValuePair>::const_iterator const_iterator;
    
    string value;
    bool has_value;
    
    StringTrie() : has_value(false) {}
    
    void copy_char_trie(const UnicodeTrie &char_trie) {
        value = char_trie.value;
        has_value = char_trie.has_value;
        add_children(char_trie);
    }
    
    void write_json(JsonWriter &json) const {
        json.begin('{');
        
        if (children.size() > 0) {
            json.key("c");
            json.begin('{');
            
            for(StringTrie::const_iterator c = children.begin(); 
                c != children.end();
                ++c)
            {
                json.key(c->first);
                c->second.write_json(json);
            }
            json.end('}');
        }
        
        if (has_value) {
            json.key("v").value(value);
        }
        json.end('}');
    }
    
private:

    void add_children(const UnicodeTrie &char_trie) {
        for (UnicodeTrie::const_iterator itr = char_trie.children.begin();
            itr != char_trie.children.end(); ++itr) {
            
            std::ostringstream edge;
            children.push_back(KeyValuePair("", StringTrie()));
            edge << itr->first;
            add_child(itr->second, children.back(), edge);
        }
    }

    void add_child(const UnicodeTrie &child, KeyValuePair& kv_pair, std::ostringstream &edge) {
        if (child.children.size() == 1 && !child.has_value) {
            edge <<  child.children.begin()->first;
            add_child(child.children.begin()->second, kv_pair, edge);
        }
        else {
            kv_pair.first = edge.str();
            kv_pair.second.copy_char_trie(child);
        }
    }
};
