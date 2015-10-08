
#include <assert.h>
#include <sstream>

#include <trie.hpp>
#include <tree.hpp>
#include <json.hpp>
#include <utf8.hpp>

template <class Trie>
void trie_structure_json(const Trie &trie, JsonWriter &json) {
    json.begin('{');
    for(typename Trie::const_iterator c = trie.children.begin(); 
        c != trie.children.end();
        ++c)
    {
        json.key(to_string(c->first));
        trie_structure_json(c->second, json);
    }
    json.end('}');
}

template <class Trie>
std::string trie_structure_json(const Trie &trie) {
    JsonWriter json;
    trie_structure_json(trie,json);
    return json.to_string();
}

#define ASSERT_JSON_ERROR(x) try { x; assert(false); } catch(JsonWriter::error&) {}

void run_json_tests() {
    {
    JsonWriter json;
    assert(json.to_string() == string(""));
    
    json.begin('{')
        .key("foo")
        .value(2)
        .key("bar")
        .begin('[')
            .value("asdf")
            .null_value()
            
            .begin('{')
            .end('}')
        
            .value(2.5)
        .end(']')
    .end('}');
    
    assert(json.to_string() == string("{\"foo\":2,\"bar\":[\"asdf\",null,{},2.5]}"));
    }
    
    JsonWriter json;
    
    ASSERT_JSON_ERROR( json.end('}') );
    ASSERT_JSON_ERROR( json.key("foo") );
    
    json.begin('{');
    ASSERT_JSON_ERROR( json.value(1) );
    ASSERT_JSON_ERROR( json.begin('{') );
    ASSERT_JSON_ERROR( json.end(']') );
    json.key("foo");
    ASSERT_JSON_ERROR( json.key("bar") );
    json.begin('[');
    ASSERT_JSON_ERROR( json.key("baz") );
    json.value(1);
    json.end(']');
    json.end('}');
    ASSERT_JSON_ERROR( json.value(1) );
    ASSERT_JSON_ERROR( json.key("fsd") );
    ASSERT_JSON_ERROR( json.end('}') );
    ASSERT_JSON_ERROR( json.begin('[') );
    
    std::cerr << "json tests passed" << std::endl;
    
}

void run_trie_tests() {
    UnicodeTrie t;
    StringTrie string_trie;
    
    std::string one("1"), two("2"), three("3");
    
    t.insert("abcd", one);
    
    assert(trie_structure_json(t) == "{\"a\":{\"b\":{\"c\":{\"d\":{}}}}}");
    assert(t.lookup("foobar") == NULL);
    assert(t.get("abcd") == one);
    
    t.insert("abf", two);
    assert(trie_structure_json(t) == "{\"a\":{\"b\":{\"c\":{\"d\":{}},\"f\":{}}}}");
    assert(t.get("abcd") == one);
    assert(t.get("abf") == two);
    assert(t.lookup("ab") == NULL);
    
    t.insert("ab", three);
    assert(trie_structure_json(t) == "{\"a\":{\"b\":{\"c\":{\"d\":{}},\"f\":{}}}}");
    assert(t.get("abcd") == one);
    assert(t.get("abf") == two);
    assert(t.get("ab") == three);
    
    string_trie.copy_char_trie(t);
    assert(trie_structure_json(string_trie) == "{\"ab\":{\"cd\":{},\"f\":{}}}");
    
    UnicodeTrie utf8_trie;
    utf8_trie.insert("\xC3\xA1", one);
    utf8_trie.insert("\xC3\xA2", two);
    assert(trie_structure_json(utf8_trie) == "{\"\xC3\xA1\":{},\"\xC3\xA2\":{}}");
    
    std::cerr << "trie tests passed" << std::endl;
}

void run_tree_of_life_tests() {
    
    std::istringstream newick_input(
        "((raccoon_ott2,bear_ott3)land_ott1,(sea_lion_ott5,seal_ott6),dog_ott7);"
    );
    
    TreeOfLife tol(newick_input);
    JsonWriter json;
    tol.write_json(json);
    
    string expected(
        "{\"s\":5,\"c\":[{\"n\":\"land\",\"s\":2,\"c\":[{\"n\":\"raccoon\"},"
        "{\"n\":\"bear\"}]},{\"s\":2,\"c\":[{\"n\":\"sea lion\"},"
        "{\"n\":\"seal\"}]},{\"n\":\"dog\"}]}"
    );
    
    assert(json.to_string() == expected);
    
    std::cerr << "tol tests passed" << std::endl;
}

void run_misc_tests() {
    
    assert(to_string(123) == string("123"));
    assert(to_string('c') == string("c"));
    
    Utf8String utf8 = decode_utf8("\xC3\xA1 10\xE2\x82\xAC");
    assert(utf8.size() == 5);
    assert(utf8[0] == string("\xC3\xA1"));
    assert(utf8[1] == string(" "));
    assert(utf8[2] == string("1"));
    assert(utf8[3] == string("0"));
    assert(utf8[4] == string("\xE2\x82\xAC"));
    
    std::cerr << "misc tests passed" << std::endl;
}

int main() {
    run_misc_tests();
    run_trie_tests();
    run_json_tests();
    run_tree_of_life_tests();
    
    std::cerr << "all passed" << std::endl;
    return 0;
}
